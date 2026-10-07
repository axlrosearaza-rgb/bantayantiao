import { useEffect, useState } from 'react'
import { CATEGORY, OFFICE, OFFICES, allowedMoves, canArchive, canSee, isEvidence, isMine, isStaffOn } from '../lib/constants'
import { AREA, distanceKm, timeAgo } from '../lib/geo'
import { CLASS_NAME, HAZARD_LAYERS, hazardAt, loadHazards } from '../lib/hazards'
import { addInternal, setStatus, useStore, setArchived } from '../lib/store'
import { StatusChip } from './ui'

export const EMERGENCY_NOTE = 'If anyone is in immediate danger, call 911 or your local disaster office now. This platform does not replace official emergency hotlines.'

const ENTRY_TYPES = [
  { id: 'message', label: 'Message', hint: 'Write to the barangay or office working on this report' },
  { id: 'action', label: 'Action taken', hint: 'What was done, and any resources or assistance provided' },
  { id: 'assignment', label: 'Assign task', hint: 'What needs doing' },
  { id: 'followup', label: 'Schedule follow-up', hint: 'What will be checked' },
  { id: 'assistance', label: 'Request technical assistance', hint: 'What help is needed' },
]
const TYPE_LABEL = { ...Object.fromEntries(ENTRY_TYPES.map((t) => [t.id, t.label])), status: 'Status change' }
const FIELD = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm'
const DT = 'font-semibold uppercase tracking-wide text-slate-400'

/** NOAH hazard class at the report's pin, read from the official layers. */
function HazardOverlap({ r }) {
  const [at, setAt] = useState(undefined)
  useEffect(() => {
    let alive = true
    loadHazards()
      .then(() => alive && setAt(hazardAt(r.latitude, r.longitude)))
      .catch(() => alive && setAt(null))
    return () => {
      alive = false
    }
  }, [r.latitude, r.longitude])
  if (at === undefined) return <span className="text-slate-400">Checking hazard layers…</span>
  if (!at) return <span className="text-slate-500">Hazard layers unavailable for this point.</span>
  return (
    <span>
      {Object.values(HAZARD_LAYERS).map((l, i) => (
        <span key={l.id}>
          {i > 0 && ' · '}
          {l.short}: <b className={at[l.id] >= 2 ? 'text-red-700' : ''}>{CLASS_NAME[at[l.id]]}</b>
        </span>
      ))}
    </span>
  )
}

export default function ReportDetail({ report, role, onViewOnMap }) {
  const { reports, updates, internal } = useStore()
  const r = reports.find((x) => x.id === report.id) || report
  const staff = isStaffOn(r, role)
  const mine = isMine(r, role)
  const moves = allowedMoves(r, role)
  const cat = CATEGORY[r.category]

  const [notes, setNotes] = useState('')
  const [office, setOffice] = useState(cat.office)
  const [assignee, setAssignee] = useState('')
  const [entry, setEntry] = useState({ type: 'message', text: '', assigned_to: '', due_date: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [archiveError, setArchiveError] = useState('')

  const history = updates.filter((u) => u.report_id === r.id)
  const log = internal.filter((u) => u.report_id === r.id)
  const nearby = reports
    .filter((x) => x.id !== r.id && canSee(x, role))
    .map((x) => ({ ...x, km: distanceKm(r, x) }))
    .filter((x) => x.km <= 2)
    .sort((a, b) => a.km - b.km)

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }
  const move = (m) => {
    if (m.needsNote && !notes.trim()) return setError(`Add a short note before you choose “${m.label}”.`)
    run(async () => {
      await setStatus(r, m, role, { notes, office: m.needsOffice ? office : null, assigned_to: m.asksAssignee ? assignee : '' })
      setNotes('')
      setAssignee('')
    })
  }
  const addEntry = (e) => {
    e.preventDefault()
    if (!entry.text.trim()) return setError('Write something first.')
    if (entry.type === 'assignment' && !entry.assigned_to.trim()) return setError('Say who the task is assigned to.')
    if (entry.type === 'followup' && !entry.due_date) return setError('Choose the follow-up date.')
    run(async () => {
      await addInternal(r, role, entry)
      setEntry({ type: entry.type, text: '', assigned_to: '', due_date: '' })
    })
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{r.id}</p>
          <h2 className="text-lg font-bold leading-tight text-slate-900">{r.title}</h2>
          <p className="text-xs text-slate-500">
            {cat.icon} {cat.label} · Severity: {r.severity}
          </p>
        </div>
        <StatusChip status={r.status} />
      </div>

      {r.urgent && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-900">
          <b>Flagged urgent by the reporter.</b> {EMERGENCY_NOTE}
        </p>
      )}

      {r.photo_url ? (
        <img src={r.photo_url} alt="Evidence submitted with the report" className="max-h-64 w-full rounded-lg bg-slate-100 object-contain" />
      ) : (
        <div className="grid h-16 place-items-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">No photo attached</div>
      )}
      <p className="text-slate-800">{r.description || <i className="text-slate-400">No description provided.</i>}</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className={DT}>Barangay (routed to)</dt>
          <dd>
            {r.barangay_name ? `${r.barangay_name}, ${r.municipality}` : 'Not set'}
            {r.place_note && <span className="block text-slate-500">{r.place_note}</span>}
          </dd>
        </div>
        <div>
          <dt className={DT}>Map pin</dt>
          <dd>
            <span className="tabular-nums">
              {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
            </span>
            <span className="block text-slate-500">{AREA[r.area_id]?.name || 'Outside Catbalogan City'}</span>
          </dd>
        </div>
        <div>
          <dt className={DT}>Submitted</dt>
          <dd>
            {new Date(r.created_at).toLocaleString()}
            <span className="block text-slate-500">{timeAgo(r.created_at)}</span>
          </dd>
        </div>
        <div>
          <dt className={DT}>Responsible office</dt>
          <dd>
            {r.forwarded_office ? OFFICE[r.forwarded_office]?.label || r.forwarded_office : 'Barangay level'}
            {(staff || !mine) && r.assigned_to && <span className="block text-slate-500">Assigned: {r.assigned_to}</span>}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className={DT}>Project NOAH hazard at the pin</dt>
          <dd>
            <HazardOverlap r={r} />
          </dd>
        </div>
        {(staff || mine) && (
          <div className="col-span-2">
            <dt className={DT}>Reporter</dt>
            <dd>
              {r.reporter_name || '—'}
              {r.contact ? (
                staff && !r.contact_shared ? (
                  <span className="block text-slate-500">Contact withheld: the reporter did not agree to share it.</span>
                ) : (
                  <span className="block text-slate-600">
                    Contact: {r.contact} {mine && !staff && <i className="text-slate-400">({r.contact_shared ? 'shared with reviewing officials only' : 'kept private'})</i>}
                  </span>
                )
              ) : (
                <span className="block text-slate-500">No contact details given.</span>
              )}
            </dd>
          </div>
        )}
      </dl>

      {r.archived_at && (
        <p className="rounded-md bg-slate-100 p-2 text-xs text-slate-700">
          <b>Archived</b> on {new Date(r.archived_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
          {r.archived_by ? ` by ${r.archived_by}` : ''}. It no longer appears in the working lists or on the map, and does not count as active evidence.
        </p>
      )}
      {/* the two actions sit side by side, with space between them */}
      {(onViewOnMap || canArchive(r, role)) && (
        <div className="flex flex-wrap items-center gap-3">
        {onViewOnMap && (
          <button onClick={() => onViewOnMap(r)} className="rounded-md border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50">
            View on map
          </button>
        )}
        {canArchive(r, role) && (
          <button
            disabled={busy}
            onClick={async () => {
              if (!r.archived_at && !confirm('Archive this report? It is kept and can be restored, but leaves the working lists and the map.')) return
              setBusy(true)
              setArchiveError('')
              try {
                await setArchived(r, role, !r.archived_at)
              } catch (e) {
                setArchiveError(e.message)
              }
              setBusy(false)
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {r.archived_at ? 'Restore from archive' : 'Archive report'}
          </button>
        )}
        </div>
      )}
      {archiveError && <p className="rounded-md bg-red-50 p-2 text-xs text-red-800" role="alert">{archiveError}</p>}

      <div>
        <p className={`text-xs ${DT}`}>Progress</p>
        <ol className="mt-1 space-y-0.5 text-xs text-slate-700">
          <li>
            <b>Submitted</b> · {new Date(r.created_at).toLocaleString()}
          </li>
          {history.map((u) => (
            <li key={u.id}>
              <b>{u.new_status}</b> · {new Date(u.created_at).toLocaleString()}
              {u.by_role && <span className="text-slate-500"> · by the {u.by_role === 'Office' ? 'office' : 'barangay'}</span>}
            </li>
          ))}
        </ol>
        {mine && !staff && (
          <p className="mt-1.5 text-[11px] text-slate-500">
            You see each stage and when it happened. Internal notes between the barangay and the office are not shown.
          </p>
        )}
      </div>

      {nearby.length > 0 && (
        <div>
          <p className={`text-xs ${DT}`}>Nearby reports (within 2 km)</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {nearby.map((n) => (
              <li key={n.id} className="flex justify-between gap-2">
                <span>
                  {CATEGORY[n.category].icon} {CATEGORY[n.category].label} · {n.km.toFixed(1)} km · {timeAgo(n.created_at)}
                </span>
                <span className={isEvidence(n) ? 'font-semibold text-green-700' : 'text-slate-500'}>{n.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      )}

      {moves.length > 0 && (
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">Next step</p>
          <label className="mt-1.5 block text-xs text-slate-600">
            Notes for the record (staff only)
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={FIELD} />
          </label>
          {moves.some((m) => m.needsOffice) && (
            <label className="mt-1.5 block text-xs text-slate-600">
              Forward to
              <select value={office} onChange={(e) => setOffice(e.target.value)} className={FIELD}>
                {OFFICES.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full} ({o.label})
                  </option>
                ))}
              </select>
            </label>
          )}
          {moves.some((m) => m.asksAssignee) && (
            <label className="mt-1.5 block text-xs text-slate-600">
              Assign personnel or team (optional)
              <input value={assignee} onChange={(e) => setAssignee(e.target.value)} className={FIELD} />
            </label>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {moves.map((m) => (
              <button
                key={m.to + m.by}
                disabled={busy}
                onClick={() => move(m)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                  m.danger ? 'bg-white text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50' : 'bg-brand-500 text-white hover:bg-brand-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">A report counts toward the watershed index only after the barangay verifies it, and until it is resolved.</p>
        </div>
      )}

      {staff && (
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-700">Coordination between barangay and office · staff only</p>
          {log.length ? (
            <ul className="mt-2 space-y-2">
              {log.map((u) => (
                <li key={u.id} className={`rounded-md p-2 text-xs ${u.by_role === role.short ? 'bg-brand-50' : 'bg-slate-50'}`}>
                  <p className="font-semibold text-slate-700">
                    {TYPE_LABEL[u.type] || u.type} · {u.user_name} ({u.by_role}) · {timeAgo(u.created_at)}
                  </p>
                  <p className="text-slate-800">{u.text}</p>
                  {u.assigned_to && <p className="text-slate-600">Assigned to: {u.assigned_to}</p>}
                  {u.due_date && <p className="text-slate-600">Follow-up on: {u.due_date}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-slate-500">No notes yet.</p>
          )}
          <form onSubmit={addEntry} className="mt-3 space-y-1.5">
            <select value={entry.type} onChange={(e) => setEntry({ ...entry, type: e.target.value })} className={FIELD} aria-label="Type of entry">
              {ENTRY_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <textarea
              rows={2}
              value={entry.text}
              onChange={(e) => setEntry({ ...entry, text: e.target.value })}
              placeholder={ENTRY_TYPES.find((t) => t.id === entry.type).hint}
              className={FIELD}
            />
            {entry.type === 'assignment' && (
              <input value={entry.assigned_to} onChange={(e) => setEntry({ ...entry, assigned_to: e.target.value })} placeholder="Assigned to (person or team)" className={FIELD} />
            )}
            {(entry.type === 'followup' || entry.type === 'assignment') && (
              <label className="block text-xs text-slate-600">
                {entry.type === 'followup' ? 'Follow-up date' : 'Due date (optional)'}
                <input type="date" value={entry.due_date} onChange={(e) => setEntry({ ...entry, due_date: e.target.value })} className={FIELD} />
              </label>
            )}
            <button disabled={busy} className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50">
              Add to record
            </button>
          </form>
        </div>
      )}

      {!staff && !mine && role.id !== 'community' && (
        <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
          You can read this verified report for planning. Reviewing and updating it is for the barangay it was routed to
          {r.forwarded_office ? ` and the ${OFFICE[r.forwarded_office]?.label || 'responsible office'}` : ''}.
        </p>
      )}
    </div>
  )
}

export function ReportModal({ report, role, onClose, onViewOnMap }) {
  if (!report) return null
  return (
    <div className="fixed inset-0 z-[2000] grid place-items-center bg-slate-900/50 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Report ${report.id}`}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ReportDetail report={report} role={role} onViewOnMap={onViewOnMap} />
        <button onClick={onClose} className="mt-4 w-full rounded-md border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Close
        </button>
      </div>
    </div>
  )
}
