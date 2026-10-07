import { useEffect, useMemo, useState } from 'react'
import ReportDetail from '../components/ReportDetail'
import { StatusChip } from '../components/ui'
import { CATEGORIES, CATEGORY, OFFICE, SEVERITIES, STATUSES, allowedMoves, canSee, isEvidence, isOpen, canAddReport } from '../lib/constants'
import { timeAgo } from '../lib/geo'
import { BARANGAY, hazardAt, loadHazards } from '../lib/hazards'
import { useStore } from '../lib/store'

const SELECT = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm'

export default function ReportsPage({ role }) {
  const { reports, ready, error } = useStore()
  const [f, setF] = useState({ status: 'All', barangay: 'All', category: 'All', severity: 'All', archived: false })
  const [selectedId, setSelectedId] = useState(null)
  const [hazardsReady, setHazardsReady] = useState(false)
  useEffect(() => {
    loadHazards()
      .then(() => setHazardsReady(true))
      .catch(() => {})
  }, [])

  const staff = role.id !== 'community'
  const scoped = useMemo(() => reports.filter((r) => canSee(r, role)), [reports, role])
  const archivedCount = scoped.filter((r) => r.archived_at).length
  const list = scoped
    .filter((r) => Boolean(r.archived_at) === f.archived) // the working list, or the archive
    .filter((r) => (f.status === 'All' || r.status === f.status) && (f.barangay === 'All' || r.barangay_id === f.barangay) && (f.category === 'All' || r.category === f.category) && (f.severity === 'All' || r.severity === f.severity))
    .sort((a, b) => Number(b.urgent && isOpen(b)) - Number(a.urgent && isOpen(a)) || b.created_at.localeCompare(a.created_at))
  const selected = scoped.find((r) => r.id === selectedId)
  const barangayIds = [...new Set(scoped.map((r) => r.barangay_id).filter(Boolean))].sort((a, b) => (BARANGAY[a]?.name || '').localeCompare(BARANGAY[b]?.name || ''))

  // barangay-level statistics, including how many reports sit on medium or high NOAH hazard cells
  const stats = useMemo(
    () =>
      barangayIds.map((id) => {
        const rows = scoped.filter((r) => r.barangay_id === id)
        const onHazard = hazardsReady
          ? rows.filter((r) => {
              const h = hazardAt(r.latitude, r.longitude)
              return h && (h.flood >= 2 || h.landslide >= 2)
            }).length
          : null
        return { id, total: rows.length, waiting: rows.filter((r) => r.status === 'Submitted' || r.status === 'Under Barangay Review').length, evidence: rows.filter(isEvidence).length, done: rows.filter((r) => !isOpen(r)).length, onHazard }
      }),
    [scoped, hazardsReady],
  )

  const unassigned = (role.id === 'officer' && !BARANGAY[role.barangay_id]) || (role.id === 'admin' && !OFFICE[role.office])

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {role.id === 'community' ? 'My reports' : role.id === 'officer' ? `Barangay dashboard${BARANGAY[role.barangay_id] ? `: ${BARANGAY[role.barangay_id].name}, ${BARANGAY[role.barangay_id].municipality}` : ''}` : `Office dashboard${OFFICE[role.office] ? `: ${OFFICE[role.office].label}` : ''}`}
          </h1>
          <p className="max-w-3xl text-sm text-slate-500">
            {role.id === 'community' && 'Follow each report you sent, stage by stage. Your barangay official reviews it first.'}
            {role.id === 'officer' && 'Reports routed to your barangay. Review and verify them, act locally, or forward them to the responsible office.'}
            {role.id === 'admin' && 'Reports forwarded to your office by barangay officials, plus verified reports across the city for planning.'}
          </p>
        </div>
        {canAddReport(role) && (
          <a href="#/report" className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            + New Report
          </a>
        )}
      </div>

      {unassigned && (
        <p role="alert" className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          This account has no {role.id === 'officer' ? 'barangay' : 'office'} assigned yet, so no reports are routed to it. An administrator sets this on the account.
        </p>
      )}
      {error && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">Could not load reports: {error}</p>}

      {staff && stats.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="px-3 pt-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Reports by barangay</caption>
            <thead className="text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {['Barangay', 'Total', 'Awaiting barangay', 'Verified and open', 'Resolved or closed', 'On medium/high NOAH hazard'].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-medium text-slate-900">{BARANGAY[s.id] ? `${BARANGAY[s.id].name}, ${BARANGAY[s.id].municipality}` : s.id}</td>
                  <td className="px-3 py-1.5 tabular-nums">{s.total}</td>
                  <td className="px-3 py-1.5 tabular-nums">{s.waiting}</td>
                  <td className="px-3 py-1.5 tabular-nums">{s.evidence}</td>
                  <td className="px-3 py-1.5 tabular-nums">{s.done}</td>
                  <td className="px-3 py-1.5 tabular-nums">{s.onHazard ?? '…'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {staff && (
          <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm font-semibold" role="group" aria-label="Which reports to show">
            <button type="button" onClick={() => setF({ ...f, archived: false })} aria-pressed={!f.archived} className={`px-3 py-1.5 ${!f.archived ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
              Active
            </button>
            <button type="button" onClick={() => setF({ ...f, archived: true })} aria-pressed={f.archived} className={`px-3 py-1.5 ${f.archived ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
              Archived ({archivedCount})
            </button>
          </div>
        )}
        <select aria-label="Filter by status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={SELECT}>
          <option value="All">All statuses ({scoped.length})</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s} ({scoped.filter((r) => r.status === s).length})
            </option>
          ))}
        </select>
        {staff && (
          <>
            <select aria-label="Filter by barangay" value={f.barangay} onChange={(e) => setF({ ...f, barangay: e.target.value })} className={SELECT}>
              <option value="All">All barangays</option>
              {barangayIds.map((id) => (
                <option key={id} value={id}>
                  {BARANGAY[id]?.name || id}
                </option>
              ))}
            </select>
            <select aria-label="Filter by category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={SELECT}>
              <option value="All">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select aria-label="Filter by severity" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} className={SELECT}>
              <option value="All">All severities</option>
              {SEVERITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_440px]">
        <ul className="space-y-2">
          {list.map((r) => {
            const todo = allowedMoves(r, role).length > 0
            return (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedId(r.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left shadow-sm hover:border-brand-500 ${
                    selectedId === r.id ? 'border-brand-500 ring-1 ring-brand-500' : r.urgent && isOpen(r) ? 'border-red-300' : 'border-slate-200'
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xl">{CATEGORY[r.category].icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {r.urgent && isOpen(r) && <span className="mr-1.5 rounded bg-red-600 px-1 py-0.5 text-[10px] font-bold uppercase text-white">Urgent</span>}
                      {r.title}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {r.barangay_name ? `Brgy. ${r.barangay_name}, ${r.municipality}` : 'Barangay not set'} · {timeAgo(r.created_at)} · {r.id}
                    </span>
                    {todo && <span className="text-[11px] font-semibold text-amber-700">Waiting for you</span>}
                  </span>
                  <StatusChip status={r.status} />
                </button>
              </li>
            )
          })}
          {ready && !list.length && (
            <li className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              {scoped.length ? 'No reports match these filters.' : role.id === 'community' ? 'You have not sent a report yet. Use “New Report” to send one.' : 'No reports are routed here yet.'}
            </li>
          )}
        </ul>

        <div className="lg:sticky lg:top-0 lg:self-start">
          {selected ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <ReportDetail report={selected} role={role} onViewOnMap={(r) => (window.location.hash = `#/?focus=${r.id}`)} />
            </div>
          ) : (
            <div className="hidden rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 lg:block">
              Select a report to see its details, progress and next step.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
