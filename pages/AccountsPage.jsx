// Administrator's page: verify new sign-ups, and see every account.
import { OFFICE, ROLES } from '../lib/constants'
import { BARANGAY } from '../lib/hazards'
import { reviewAccount, useAccounts } from '../lib/accounts'
import { BACKEND } from '../lib/store'

const STATUS = {
  pending: ['Waiting for verification', 'bg-amber-50 text-amber-800 ring-amber-200'],
  approved: ['Verified', 'bg-green-50 text-green-800 ring-green-200'],
  rejected: ['Rejected', 'bg-red-50 text-red-800 ring-red-200'],
}
const servesText = (a) =>
  a.role === 'officer' ? (BARANGAY[a.barangay_id] ? `Brgy. ${BARANGAY[a.barangay_id].name}` : 'No barangay') : a.role === 'admin' ? OFFICE[a.office]?.label || 'No office' : '—'
const dateText = (iso) => (iso ? new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

function Row({ a, me }) {
  const [label, tone] = STATUS[a.status] || STATUS.pending
  const own = a.username === me
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">
          {a.name} <span className="font-normal text-slate-500">· {a.username}</span>
        </p>
        <p className="text-sm text-slate-600">
          {ROLES[a.role]?.label || a.role} · {servesText(a)}
        </p>
        {a.email && !a.sample && !a.email.endsWith('@users.bantaytubig.app') && (
          <p className="text-sm text-slate-600">
            {a.email}
            {BACKEND === 'supabase' && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${a.email_verified ? 'bg-green-50 text-green-800 ring-green-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
                {a.email_verified ? 'Email confirmed' : 'Email not confirmed yet'}
              </span>
            )}
          </p>
        )}
        <p className="text-xs text-slate-500">
          Signed up {dateText(a.created_at)}
          {a.reviewed_by ? ` · ${a.status === 'approved' ? 'verified' : 'rejected'} by ${a.reviewed_by}, ${dateText(a.reviewed_at)}` : a.sample ? ' · sample administrator account' : ''}
        </p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}>{label}</span>
      {!own && (
        <div className="flex gap-2">
          {a.status !== 'approved' && (
            <button onClick={() => reviewAccount(a.username, 'approved', me).catch((e) => alert(e.message))} className="rounded-md bg-brand-900 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
              Approve
            </button>
          )}
          {a.status !== 'rejected' && (
            <button
              onClick={() => (a.status === 'pending' || confirm(`Stop ${a.username} from logging in?`)) && reviewAccount(a.username, 'rejected', me).catch((e) => alert(e.message))}
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
            >
              {a.status === 'pending' ? 'Reject' : 'Revoke'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

export default function AccountsPage({ me }) {
  const accounts = useAccounts()
  const pending = accounts.filter((a) => a.status === 'pending')
  const others = accounts.filter((a) => a.status !== 'pending')
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-5 overflow-y-auto p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Accounts</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Everyone who signs up waits here until an administrator verifies them. Only verified accounts can log in. Check that the person really
          serves the barangay or office they chose before approving.
        </p>
        {BACKEND === 'local' && (
          <p className="mt-2 max-w-3xl rounded-md bg-amber-50 p-2.5 text-sm text-amber-900">
            <b>Prototype:</b> accounts are saved in this browser only, so you will only see sign-ups made on this device and browser.
          </p>
        )}
      </div>

      <section aria-labelledby="acc-pending">
        <h2 id="acc-pending" className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
          Waiting for verification ({pending.length})
        </h2>
        {pending.length ? (
          <ul className="space-y-2">{pending.map((a) => <Row key={a.username} a={a} me={me} />)}</ul>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No sign-ups are waiting.</p>
        )}
      </section>

      <section aria-labelledby="acc-all">
        <h2 id="acc-all" className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
          Reviewed accounts ({others.length})
        </h2>
        <ul className="space-y-2">{others.map((a) => <Row key={a.username} a={a} me={me} />)}</ul>
      </section>
    </div>
  )
}
