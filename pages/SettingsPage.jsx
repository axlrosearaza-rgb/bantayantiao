// Account settings for the signed-in person: change the password; the administrator can also change the
// display name and the office the account acts for.
import { useState } from 'react'
import { OFFICES } from '../lib/constants'
import { changeOwnPassword, updateOwnAccount } from '../lib/accounts'
import { Card } from '../components/ui'

const INPUT = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-normal'
const LABEL = 'block text-sm font-semibold text-slate-700'
const BUTTON = 'rounded-full bg-forest px-5 py-2 text-sm font-bold text-white hover:bg-leaf disabled:opacity-50'
const Note = ({ m }) => (m ? <p className={`rounded-md p-2 text-sm ${m.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`} role={m.ok ? 'status' : 'alert'}>{m.text}</p> : null)

export default function SettingsPage({ session, role, onChanged }) {
  const admin = role.id === 'admin'
  const [name, setName] = useState(session.name || '')
  const [office, setOffice] = useState(session.office || 'MENRO')
  const [profileMsg, setProfileMsg] = useState(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [passMsg, setPassMsg] = useState(null)
  const [busy, setBusy] = useState('')

  const saveProfile = async (e) => {
    e.preventDefault()
    setProfileMsg(null)
    if (!name.trim()) return setProfileMsg({ text: 'Enter a name.' })
    setBusy('profile')
    try {
      await updateOwnAccount(session, { name: name.trim(), office })
      setProfileMsg({ ok: true, text: 'Saved.' })
      onChanged({ name: name.trim(), office })
    } catch (err) {
      setProfileMsg({ text: err.message })
    }
    setBusy('')
  }
  const savePassword = async (e) => {
    e.preventDefault()
    setPassMsg(null)
    if (next.length < 8) return setPassMsg({ text: 'The new password must be at least 8 characters.' })
    if (next !== again) return setPassMsg({ text: 'The two new passwords do not match.' })
    if (next === current) return setPassMsg({ text: 'The new password is the same as the current one.' })
    setBusy('password')
    try {
      await changeOwnPassword(session, current, next)
      setCurrent('')
      setNext('')
      setAgain('')
      setPassMsg({ ok: true, text: 'Password changed. Use the new one the next time you log in.' })
    } catch (err) {
      setPassMsg({ text: err.message })
    }
    setBusy('')
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">
          Signed in as <b>{session.username || session.email}</b> · {role.label}
        </p>
      </div>

      <Card title="Account details">
        {admin ? (
          <form onSubmit={saveProfile} className="space-y-3">
            <label className={LABEL}>
              Display name
              <input id="set-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
            </label>
            <label className={LABEL}>
              Office this account acts for
              <select id="set-office" className={INPUT} value={office} onChange={(e) => setOffice(e.target.value)}>
                {OFFICES.map((o) => (
                  <option key={o.id} value={o.id}>{o.full} ({o.label})</option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">Reports forwarded to this office appear on your Reports page.</span>
            </label>
            <Note m={profileMsg} />
            <button type="submit" className={BUTTON} disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save details'}</button>
          </form>
        ) : (
          <p className="text-sm text-slate-600">
            Name: <b>{session.name}</b>. Your name and barangay are set by the administrator; ask the Municipal / Environmental Office to change them.
          </p>
        )}
      </Card>

      <Card title="Change password">
        <form onSubmit={savePassword} className="space-y-3">
          <label className={LABEL}>
            Current password
            <input id="set-current" className={INPUT} type={show ? 'text' : 'password'} required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className={LABEL}>
            New password
            <input id="set-next" className={INPUT} type={show ? 'text' : 'password'} required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            <span className="mt-1 block text-xs font-normal text-slate-500">At least 8 characters.</span>
          </label>
          <label className={LABEL}>
            Confirm new password
            <input id="set-again" className={INPUT} type={show ? 'text' : 'password'} required autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input id="set-show" type="checkbox" className="h-4 w-4" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords
          </label>
          <Note m={passMsg} />
          <button type="submit" className={BUTTON} disabled={busy === 'password'}>{busy === 'password' ? 'Changing…' : 'Change password'}</button>
        </form>
      </Card>
    </div>
  )
}
