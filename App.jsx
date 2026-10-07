import { useEffect, useState } from 'react'
import { ROLES, OFFICE, TAGLINE, canAddReport, isUrgentFor } from './lib/constants'
import { BARANGAY } from './lib/hazards'
import {
  BACKEND,
  finishEmailConfirmation,
  getUserProfile,
  sessionOf,
  supabase,
  supabaseSignOut,
  resetDemo,
  useStore,
} from './lib/store'
import Auth from './pages/Auth'
import PublicSite from './pages/PublicSite'
import Dashboard from './pages/Dashboard'
import ReportsPage from './pages/ReportsPage'
import DataPage from './pages/DataPage'
import AboutPage from './pages/AboutPage'
import AccountsPage from './pages/AccountsPage'
import SettingsPage from './pages/SettingsPage'
import { useAccounts } from './lib/accounts'
import ReportWizard from './pages/ReportWizard'

function useRoute() {
  const read = () => {
    const [path, query = ''] = (window.location.hash.slice(1) || '/').split('?')
    return { path, params: new URLSearchParams(query) }
  }
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

const NAV = [
  { id: 'dashboard', href: '#/', label: 'Hazard map & risk' },
  { id: 'reports', href: '#/reports', label: 'Reports' },
  { id: 'accounts', href: '#/accounts', label: 'Accounts' },
  { id: 'data', href: '#/data', label: 'Data Sources' },
  { id: 'about', href: '#/about', label: 'About' },
  { id: 'settings', href: '#/settings', label: 'Settings' },
]

const SESSION_KEY = 'bantay-ulot:session'

export default function App() {
  const { path, params } = useRoute()
  const { reports } = useStore()
  const pendingAccounts = useAccounts().filter((a) => a.status === 'pending').length
  const [session, setSession] = useState(() => {
    if (BACKEND !== 'local') return null
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY))
    } catch {
      return null
    }
  })
  const [authReady, setAuthReady] = useState(BACKEND === 'local')
  const [authError, setAuthError] = useState('')

  // descriptive page titles for browser tabs, history and search engines
  useEffect(() => {
    const names = { '/': session ? 'GIS Hazard Map' : 'Home', '/analysis': 'GIS Hazard Map', '/reports': 'Community Reports', '/data': 'Data Sources', '/about': 'About', '/accounts': 'Accounts', '/settings': 'Settings', '/report': 'Report a Concern', '/login': 'Log in', '/reset': 'Set a new password', '/signup': 'Sign up', '/map': 'GIS Hazard Map' }
    document.title = path === '/' && !session ? `Bantay Antiao | ${TAGLINE}` : `${names[path] || 'GIS Hazard Map'} | Bantay Antiao`
  }, [path, session])

  // opened from the confirmation link in the sign-up email: show the result on the log-in page
  useEffect(() => {
    finishEmailConfirmation().then((result) => {
      if (!result) return
      try {
        if (result.text) sessionStorage.setItem('bantay:notice', result.text)
      } catch {
        // without session storage the message is simply not shown
      }
      window.location.reload()
    })
  }, [])

  // with Supabase the signed-in account comes from its own session; only approved accounts get in
  useEffect(() => {
    if (BACKEND !== 'supabase') return
    let alive = true
    const load = async (user) => {
      try {
        const profile = user ? await getUserProfile(user.id) : null
        if (!alive) return
        setSession(profile?.status === 'approved' ? sessionOf(profile) : null)
        setAuthError('')
      } catch (error) {
        if (!alive) return
        setSession(null)
        setAuthError(`Signed in, but could not load your account: ${error.message}`)
      } finally {
        if (alive) setAuthReady(true)
      }
    }
    supabase.auth.getSession().then(({ data }) => load(data.session?.user))
    // the callback must not call Supabase itself, so the work is deferred
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => setTimeout(() => load(current?.user), 0))
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = (s) => {
    if (BACKEND === 'local') localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setSession(s)
    window.location.hash = '#/'
  }
  const signOut = async () => {
    try {
      if (BACKEND === 'supabase') await supabaseSignOut()
      localStorage.removeItem(SESSION_KEY)
      setSession(null)
      window.location.hash = '#/'
    } catch (error) {
      alert(`Could not sign out: ${error.message}`)
    }
  }

  if (!authReady) {
    return <div className="grid min-h-screen place-items-center text-brand-900">Connecting…</div>
  }
  if (authError) {
    return <div className="mx-auto mt-16 max-w-xl rounded-xl bg-red-50 p-5 text-red-900" role="alert">{authError}</div>
  }

  // back from a password reset link: the new-password form, whoever the link has signed in
  if (path === '/reset') return <Auth mode="reset" onSignIn={signIn} />

  // signed out: public landing page, with sign-in at #/login
  if (!session || !ROLES[session.roleId]) {
    if (path === '/login' || path === '/signup') return <Auth mode={path.slice(1)} onSignIn={signIn} />
    // public site: landing page at /, GIS map at /map, plus /about, /reports and /analysis
    return <PublicSite path={path} />
  }
  const base = ROLES[session.roleId]
  const role = {
    ...base,
    user: {
      ...base.user,
      id: session.id || base.user.id,
      ...(session.name ? { name: session.name } : {}),
    },
    // who this account acts for: one barangay (officials) or one office (office staff)
    barangay_id: session.barangay_id || null,
    office: session.office || null,
  }
  const acting =
    role.id === 'officer'
      ? BARANGAY[role.barangay_id]
        ? `Brgy. ${BARANGAY[role.barangay_id].name}, ${BARANGAY[role.barangay_id].municipality}`
        : 'No barangay assigned yet'
      : role.id === 'admin'
        ? OFFICE[role.office]?.label || 'No office assigned yet'
        : null
  // in-app notification: reports waiting for this account to act
  const waiting = reports.filter((r) =>
    role.id === 'officer'
      ? r.barangay_id === role.barangay_id && r.status === 'Submitted'
      : role.id === 'admin'
        ? (r.forwarded_office === role.office && r.status === 'Forwarded to Responsible Office') || (isUrgentFor(r, role) && !r.forwarded_office && r.status !== 'Closed' && r.status !== 'Resolved')
        : false,
  ).length

  // the report form is not open to barangay officials, even by typing its address
  if (path === '/report' && canAddReport(role)) return <ReportWizard role={role} />

  let page = { '/': 'dashboard', '/reports': 'reports', '/data': 'data', '/about': 'about', '/accounts': 'accounts', '/settings': 'settings' }[path] || 'dashboard'
  if (!role.pages.includes(page)) page = role.pages[0]

  return (
    <div className="app-shell flex min-h-full flex-col lg:h-screen">
      {/* the same top navigation as the landing page: logo, pages with a blue underline, account button */}
      <header className="z-[1100] flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-white px-4 py-2 shadow-[0_8px_24px_-18px_rgb(16_41_31/0.5)] lg:h-[66px] lg:flex-nowrap lg:px-8 lg:py-0">
        <a href="#/" className="mr-auto flex items-center gap-2.5" aria-label="Bantay Antiao home">
          <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0 text-river" aria-hidden="true">
            <path fill="currentColor" d="M16 2.500C10.500 10 6.500 14.800 6.500 20.300a9.500 9.500 0 0 0 19 0C25.500 14.800 21.500 10 16 2.500zm-4.300 18.300a1.200 1.200 0 0 1 2.400 0 2.900 2.900 0 0 0 2.900 2.900 1.200 1.200 0 0 1 0 2.400 5.300 5.300 0 0 1-5.300-5.300z" />
          </svg>
          <span>
            <span className="block font-display text-[1.2rem] font-extrabold leading-tight tracking-tight text-forest">Bantay Antiao</span>
            <span className="block text-[0.68rem] font-semibold uppercase leading-tight tracking-[0.08em] text-moss">Catbalogan City</span>
          </span>
        </a>
        <nav aria-label="Main" className="order-3 flex w-full gap-1 overflow-x-auto lg:order-none lg:w-auto">
          {NAV.filter((n) => role.pages.includes(n.id)).map((n) => {
            const count = n.id === 'reports' ? waiting : n.id === 'accounts' ? pendingAccounts : 0
            return (
              <a
                key={n.id}
                href={n.href}
                aria-current={page === n.id ? 'page' : undefined}
                className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-[0.98rem] font-semibold ${
                  page === n.id ? 'text-forest' : 'text-moss hover:bg-leaf/10 hover:text-forest'
                }`}
              >
                {n.label}
                {count > 0 && (
                  <span
                    className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold leading-none text-slate-900"
                    title={n.id === 'reports' ? `${count} report(s) waiting for you` : `${count} sign-up(s) waiting for verification`}
                  >
                    {count}
                  </span>
                )}
                {page === n.id && <span className="absolute inset-x-3 bottom-1 h-[3px] rounded-full bg-river" />}
              </a>
            )
          })}
        </nav>
        <div className="flex items-center gap-3 lg:ml-2">
          {BACKEND === 'local' && (
            <button
              onClick={() => confirm('Restore the original demo reports? Reports you submitted will be removed.') && resetDemo()}
              className="hidden rounded-md px-2 py-1 text-[11px] text-moss hover:bg-mint hover:text-forest xl:inline"
              title="Local demo mode: data lives in this browser"
            >
              Reset demo
            </button>
          )}
          <span className="hidden text-right leading-tight md:block">
            <span className="block text-sm font-semibold text-ink">{role.label}</span>
            <span className="block text-[11px] text-moss">{acting ? `${acting} · ` : ''}{session.username || session.email}</span>
          </span>
          <button onClick={signOut} className="rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgb(31_96_69/0.7)] hover:bg-leaf">
            Sign out
          </button>
        </div>
      </header>

      {page === 'dashboard' && <Dashboard role={role} focusId={params.get('focus')} />}
      {page === 'reports' && <ReportsPage role={role} />}
      {page === 'data' && <DataPage />}
      {page === 'about' && <AboutPage />}
      {page === 'accounts' && <AccountsPage me={session.username || session.email} />}
      {page === 'settings' && (
        <SettingsPage
          session={session}
          role={role}
          onChanged={(patch) => {
            const next = { ...session, ...patch }
            if (BACKEND === 'local') localStorage.setItem(SESSION_KEY, JSON.stringify(next))
            setSession(next)
          }}
        />
      )}
    </div>
  )
}
