// Hazard map and risk analysis for signed-in staff, on one page: the shared map-and-analysis unit
// (components/HazardRiskMap.jsx) with the account's reports as dots on the map and a strip of them under it.
import { useMemo, useState } from 'react'
import './home.css'
import HazardRiskMap from '../components/HazardRiskMap'
import { ReportModal } from '../components/ReportDetail'
import { StatusChip } from '../components/ui'
import { CATEGORY, canAddReport, canSee } from '../lib/constants'
import { AREA, timeAgo } from '../lib/geo'
import { useStore } from '../lib/store'

export default function Dashboard({ role, focusId }) {
  const { reports } = useStore()
  const [openId, setOpenId] = useState(focusId || null)
  // only the reports this account may open; archived ones are on the Reports page
  const mine = useMemo(() => reports.filter((r) => canSee(r, role) && !r.archived_at).sort((a, b) => b.created_at.localeCompare(a.created_at)), [reports, role])
  const openReport = mine.find((r) => r.id === openId)

  const strip = (
    <section className="border-t border-slate-200 bg-white px-3 py-2.5" aria-label="Reports">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {role.id === 'officer' ? 'Reports for my barangay' : role.id === 'admin' ? 'Reports for my office' : 'My reports'}
          <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
            Purple dots on the map: filled = verified, hollow = not yet verified.
          </span>
        </h3>
        {canAddReport(role) && (
          <a href="#/report" target="_blank" rel="noreferrer" className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
            + New Report
          </a>
        )}
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {mine.slice(0, 14).map((r) => (
          <li key={r.id} className="shrink-0">
            <button
              onClick={() => setOpenId(r.id)}
              className={`w-56 rounded-lg border p-2 text-left hover:border-brand-500 ${r.urgent && r.status === 'Submitted' ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}
            >
              <span className="block truncate text-sm font-semibold text-slate-900">
                {CATEGORY[r.category].icon} {r.title}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {r.barangay_name ? `Brgy. ${r.barangay_name}` : AREA[r.area_id]?.name || 'Location not set'} · {timeAgo(r.created_at)}
              </span>
              <span className="mt-1 block">
                <StatusChip status={r.status} />
              </span>
            </button>
          </li>
        ))}
        {!mine.length && <li className="py-3 text-sm text-slate-400">No reports here yet.</li>}
      </ul>
    </section>
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <HazardRiskMap mapClass="bt dash-map" reports={reports} listReports={mine} onOpenReport={setOpenId} role={role} between={strip} />
      <ReportModal report={openReport} role={role} onClose={() => setOpenId(null)} />
    </div>
  )
}
