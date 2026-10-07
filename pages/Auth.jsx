import { useEffect, useRef, useState } from 'react'
import './home.css'
import { OFFICES, TAGLINE } from '../lib/constants'
import { GMAIL_RULE, USERNAME_RULE, cleanUsername, digest, ensureAdmin, isUsernameTaken, loadAccounts, requestAccount } from '../lib/accounts'
import { BARANGAYS, MUNICIPALITIES } from '../lib/hazards'
import {
  BACKEND,
  requestPasswordReset,
  setNewPassword,
  supabaseSignIn,
  supabaseSignUp,
} from '../lib/store'
import { initTopo } from './homeEffects'

// Accounts are for the people who handle reports. Residents report without one, on the Community Reports page.
const SIGNUP_ROLES = ['officer'] // the office (administrator) account is created by setup, not through sign-up

const COPY = {
  signup: {
    eyebrow: 'Join the watch',
    title: (
      <>
        The people nearest the water <em>see it first.</em>
      </>
    ),
    lede: 'Accounts are for barangay officials, who review what residents report. The Municipal / Environmental Office approves each sign-up.',
    steps: [
      ['Create your account', 'Name, username, Gmail address and the barangay you serve.'],
      ['Wait for verification', 'An administrator checks your sign-up. You can log in once it is approved.'],
      ['Review and act', 'Barangay officials verify resident reports and can forward them to the MENRO or MDRRMO, which acts on them.'],
    ],
  },
  login: {
    eyebrow: 'Welcome back',
    title: (
      <>
        Back to the <em>source.</em>
      </>
    ),
    lede: 'Log in to review the reports for your barangay or office and open the watershed dashboard.',
    steps: [
      ['Reports', 'Every report keeps its reference number and status history.'],
      ['Map', 'Areas are coloured by pressure, with the reasons shown.'],
      ['Actions', 'Each recommendation names why it was raised and who could lead it.'],
    ],
  },
}

// A password scores one point for each of these, shown on the 0–4 strength meter.
const PW_RULES = [(p) => p.length >= 12, (p) => /[a-z]/.test(p) && /[A-Z]/.test(p), (p) => /\d/.test(p), (p) => /[^A-Za-z0-9]/.test(p)]
const PW_LEVEL = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
function passwordStrength(p) {
  const score = p.length < 8 ? 0 : Math.max(1, PW_RULES.filter((ok) => ok(p)).length)
  return { score, label: PW_LEVEL[score] }
}
const Eye = ({ off }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.600-6.500 10-6.500S22 12 22 12s-3.600 6.500-10 6.500S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
)

export default function Auth({ mode, onSignIn }) {
  const signup = mode === 'signup'
  const reset = mode === 'reset' // opened from the link in a password reset email
  const [forgot, setForgot] = useState(false) // asking for that email, from the log-in form
  const copy = COPY[signup ? 'signup' : 'login']
  const [name, setName] = useState('')
  const [email, setEmail] = useState('') // the username field
  const [gmail, setGmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const strength = passwordStrength(password)
  const roleId = SIGNUP_ROLES[0] // every sign-up is a barangay official
  const [barangayId, setBarangayId] = useState('')
  const [office, setOffice] = useState('MENRO')
  const [error, setError] = useState('')
  // a message carried over from the email confirmation link, if this page was opened by it
  const [notice, setNotice] = useState(() => {
    try {
      const kept = sessionStorage.getItem('bantay:notice') || ''
      sessionStorage.removeItem('bantay:notice')
      return kept
    } catch {
      return ''
    }
  })
  const [busy, setBusy] = useState(false)
  const root = useRef(null)
  const hero = useRef(null)
  const canvas = useRef(null)
  const nav = useRef(null)

  // same moving background and scroll-solid nav as the landing page
  useEffect(() => {
    const stop = initTopo(root.current, hero.current, canvas.current)
    const onScroll = () => nav.current.classList.toggle('solid', window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      stop()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  useEffect(() => {
    if (BACKEND === 'local') ensureAdmin() // the sample administrator; with Supabase see supabase/seed.sql
  }, [])

  // sign-up: a moment after typing stops, check whether the username is free ('checking' | 'free' | 'taken' | null)
  const [nameState, setNameState] = useState(null)
  useEffect(() => {
    const wanted = cleanUsername(email)
    if (!signup || !USERNAME_RULE.test(wanted)) return setNameState(null)
    setNameState('checking')
    let alive = true
    const timer = setTimeout(() => {
      isUsernameTaken(wanted)
        .then((taken) => alive && setNameState(taken === null ? null : taken ? 'taken' : 'free'))
        .catch(() => alive && setNameState(null))
    }, 400)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [email, signup])

  // moving between Log in and Sign up clears the error and the typed passwords
  useEffect(() => {
    setError('')
    setPassword('')
    setConfirm('')
    setShowPw(false)
    setForgot(false)
    window.scrollTo(0, 0)
  }, [mode])

  const logIn = async (mail) => {
    if (BACKEND === 'supabase') return onSignIn(await supabaseSignIn(mail, password))
    await ensureAdmin()
    const hash = await digest(mail, password)
    const acct = loadAccounts().find((a) => a.username === mail)
    if (!acct) throw new Error('No account uses this username. Sign up first.')
    if (acct.hash !== hash) throw new Error('That password is incorrect.')
    if (acct.status === 'pending') throw new Error('Your account is waiting for an administrator to verify it. You can log in once it is approved.')
    if (acct.status === 'rejected') throw new Error('An administrator did not approve this account. Contact the Municipal / Environmental Office.')
    if ((acct.role === 'officer' && !acct.barangay_id) || (acct.role === 'admin' && !acct.office))
      throw new Error('This account was created before barangay and office assignment existed. Please sign up again with a different username.')
    onSignIn({ id: `local:${acct.username}`, roleId: acct.role, username: acct.username, email: acct.email || '', name: acct.name, barangay_id: acct.barangay_id || null, office: acct.office || null })
  }

  const signUp = async (mail) => {
    if (!name.trim()) throw new Error('Please enter your name.')
    if (nameState === 'taken') throw new Error('That username is already taken. Choose another one.')
    if (password.length < 8) throw new Error('Password must be at least 8 characters.')
    if (password !== confirm) throw new Error('The two passwords do not match.')
    if (!USERNAME_RULE.test(mail)) throw new Error('Username must be 3 to 20 characters: letters, numbers, dots, dashes or underscores, with no spaces.')
    const address = gmail.trim().toLowerCase()
    if (!GMAIL_RULE.test(address)) throw new Error('Enter a valid Gmail address, for example juan.delacruz@gmail.com.')
    if (roleId === 'officer' && !barangayId) throw new Error('Choose the barangay you serve.')
    const request = { username: mail, email: address, name: name.trim(), password, role: roleId, barangay_id: roleId === 'officer' ? barangayId : null, office: roleId === 'admin' ? office : null }
    const result = BACKEND === 'supabase' ? await supabaseSignUp(request) : await requestAccount(request)
    setNotice(
      result?.needsEmail
        ? `We sent a confirmation link to ${address}. Open it to confirm your email, then wait for an administrator to approve your account.`
        : 'Sign-up sent. An administrator must verify your account before you can log in.',
    )
    window.location.hash = '#/login'
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (signup) setNotice('')
    setBusy(true)
    try {
      await (signup ? signUp : logIn)(cleanUsername(email))
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  // forgot password, step 1: email the reset link to the address on the account
  const sendReset = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const { sentTo, certain } = await requestPasswordReset(cleanUsername(email))
      setNotice(
        certain
          ? `We sent a link to ${sentTo}. Open it on this device to set a new password. Check the spam folder if it does not arrive.`
          : `If an account uses ${sentTo}, a link to set a new password is on its way there. Open it on this device, and check the spam folder if it does not arrive.`,
      )
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }
  // forgot password, step 2: back from that link, choose the new password
  const saveNewPassword = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    try {
      await setNewPassword(password)
      const done = 'Your password has been changed. Log in with the new one.'
      try {
        sessionStorage.setItem('bantay:notice', done)
      } catch {
        // shown below anyway if this page stays open
      }
      setNotice(done)
      window.location.hash = '#/login'
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="bt" ref={root}>
      <header className="nav" ref={nav}>
        <div className="wrap nav-in">
          <a className="logo" href="#/" aria-label="Bantay Antiao home">
            <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 2.5C10.5 10 6.5 14.8 6.5 20.3a9.500 9.500 0 0 0 19 0C25.500 14.800 21.500 10 16 2.500zm-4.300 18.300a1.200 1.200 0 0 1 2.400 0 2.900 2.900 0 0 0 2.900 2.900 1.200 1.200 0 0 1 0 2.400 5.300 5.300 0 0 1-5.300-5.300z" /></svg>
            <span>
              Bantay Antiao
              <small>{TAGLINE}</small>
            </span>
          </a>
          <a className="auth-back" href="#/">Back to home</a>
        </div>
      </header>

      <main className="auth" ref={hero}>
        <canvas id="topo" ref={canvas} aria-hidden="true" />
        <div className="wrap auth-grid">

        <section className="auth-side">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lede">{copy.lede}</p>
          <ol className="auth-steps">
            {copy.steps.map(([title, text], i) => (
              <li key={title}>
                <span className="mono">0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="auth-form">
          <div className={`auth-card${signup ? ' signup' : ''}`}>
            <nav className="auth-tabs" aria-label="Account">
              <a href="#/signup" aria-current={signup ? 'page' : undefined}>Sign up</a>
              <a href="#/login" aria-current={signup ? undefined : 'page'}>Log in</a>
            </nav>

            <h2>{signup ? 'Create your account' : reset ? 'Set a new password' : forgot ? 'Forgot password' : 'Log in'}</h2>

            {reset || forgot ? (
              <form onSubmit={reset ? saveNewPassword : sendReset}>
                {reset ? (
                  <>
                    <label className="field">
                      New password
                      <span className="pw-wrap">
                        <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw}>
                          <Eye off={showPw} />
                        </button>
                      </span>
                      {password ? (
                        <span className="pw-meter" data-score={strength.score} role="status">
                          <span className="pw-bars" aria-hidden="true"><i /><i /><i /><i /></span>
                          <b>{strength.label}</b>
                        </span>
                      ) : (
                        <small>At least 8 characters.</small>
                      )}
                    </label>
                    <label className="field">
                      Confirm new password
                      <span className="pw-wrap">
                        <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                      </span>
                      {confirm && confirm !== password && <small className="pw-bad">The two passwords do not match yet.</small>}
                    </label>
                  </>
                ) : (
                  <>
                    <p className="auth-help">
                      Enter your username or the Gmail address you signed up with. We will email a link to that Gmail address; only that link can set a new password.
                    </p>
                    <label className="field">
                      Username or Gmail address
                      <input name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
                    </label>
                  </>
                )}
                {notice && <p className="msg ok" role="status">{notice}</p>}
                {error && <p className="msg err" role="alert">{error}</p>}
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Please wait…' : reset ? 'Save new password' : 'Email me a reset link'}
                </button>
                {reset ? (
                  <a className="auth-forgot" href="#/login">Back to log in</a>
                ) : (
                  <button type="button" className="auth-forgot" onClick={() => (setForgot(false), setError(''), setNotice(''))}>
                    Back to log in
                  </button>
                )}
              </form>
            ) : (
            <form onSubmit={submit}>
              {signup && (
                <label className="field">
                  Full name
                  <input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
              )}
              <label className="field">
                {signup || BACKEND === 'local' ? 'Username' : 'Username or Gmail address'}
                <input name="username" required autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={signup ? 20 : undefined} value={email} onChange={(e) => setEmail(e.target.value)} />
                {signup && nameState === 'taken' && <small className="pw-bad" role="status">This username is already taken.</small>}
                {signup && nameState === 'free' && <small className="pw-ok" role="status">This username is available.</small>}
                {signup && nameState === 'checking' && <small role="status">Checking…</small>}
                {signup && !nameState && <small>{email.trim() && !USERNAME_RULE.test(cleanUsername(email)) ? 'Use 3 to 20 letters, numbers, dots, dashes or underscores, no spaces.' : '3 to 20 characters, no spaces.'}</small>}
              </label>
              {signup && (
                <label className="field">
                  Gmail address
                  <input name="email" type="email" required autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="you@gmail.com" value={gmail} onChange={(e) => setGmail(e.target.value)} />
                  {gmail.trim() && !GMAIL_RULE.test(gmail.trim().toLowerCase()) ? (
                    <small className="pw-bad">This is not a valid Gmail address yet.</small>
                  ) : (
                    <small>{BACKEND === 'supabase' ? 'We will send a confirmation link here to check that the address is real.' : 'Used to contact you about your account.'}</small>
                  )}
                </label>
              )}
              <label className="field">
                Password
                <span className="pw-wrap">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete={signup ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw}>
                    <Eye off={showPw} />
                  </button>
                </span>
                {signup && (
                  <>
                    {password ? (
                      <span className="pw-meter" data-score={strength.score} role="status">
                        <span className="pw-bars" aria-hidden="true"><i /><i /><i /><i /></span>
                        <b>{strength.label}</b>
                      </span>
                    ) : (
                      <small>At least 8 characters.</small>
                    )}
                  </>
                )}
              </label>
              {!signup && (
                <button type="button" className="auth-forgot" onClick={() => (setForgot(true), setError(''), setNotice(''))}>
                  Forgot password?
                </button>
              )}
              {signup && (
                <>
                  <label className="field">
                    Confirm password
                    <span className="pw-wrap">
                      <input type={showPw ? 'text' : 'password'} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                      <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw}>
                        <Eye off={showPw} />
                      </button>
                    </span>
                    {confirm && confirm !== password && <small className="pw-bad">The two passwords do not match yet.</small>}
                  </label>
                  <fieldset className="roles">
                      {roleId === 'officer' && (
                        <label className="field">
                          Barangay you serve
                          <select value={barangayId} onChange={(e) => setBarangayId(e.target.value)} required>
                            <option value="">Choose a barangay…</option>
                            {MUNICIPALITIES.map((m) => (
                              <optgroup key={m} label={m}>
                                {BARANGAYS.filter((b) => b.municipality === m).map((b) => (
                                  <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </label>
                      )}
                      {roleId === 'admin' && (
                        <label className="field">
                          Your office
                          <select value={office} onChange={(e) => setOffice(e.target.value)}>
                            {OFFICES.map((o) => (
                              <option key={o.id} value={o.id}>{o.full} ({o.label})</option>
                            ))}
                          </select>
                        </label>
                      )}
                  </fieldset>
                </>
              )}

              {notice && !signup && <p className="msg ok" role="status">{notice}</p>}
              {error && <p className="msg err" role="alert">{error}</p>}

              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Please wait…' : signup ? 'Sign up for verification' : 'Log in'}
              </button>
            </form>
            )}

            {signup && (
              <p className="auth-res">
                Resident? You do not need an account. <a href="#/reports">Report an issue here</a>.
              </p>
            )}
            {BACKEND === 'local' && (
              <p className="auth-note mono">Prototype: accounts are saved in this browser only.</p>
            )}
          </div>
        </section>
        </div>
        <div className="wave" aria-hidden="true" style={{ color: 'var(--bg-2)' }}>
          <svg viewBox="0 0 2400 80" preserveAspectRatio="none"><path fill="currentColor" d="M0 40Q150 5 300 40T600 40T900 40T1200 40T1500 40T1800 40T2100 40T2400 40V80H0Z" /></svg>
          <svg viewBox="0 0 2400 80" preserveAspectRatio="none"><path fill="currentColor" d="M0 30Q150 60 300 30T600 30T900 30T1200 30T1500 30T1800 30T2100 30T2400 30V80H0Z" /></svg>
        </div>
      </main>
    </div>
  )
}
