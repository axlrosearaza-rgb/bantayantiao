import { isEvidence, LEVELS } from '../lib/constants'
import { AREAS } from '../lib/geo'
import { DRIVERS, NORMS, WEIGHTS, hazardParts, riparianDisturbedPct } from '../lib/wpi'
import { Shares } from './HazardTools'
import { ActionCard, Card, Info, LevelBadge } from './ui'

const WPI_TIP = 'This index is a transparent planning indicator and should not be interpreted as a definitive environmental prediction.'

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  )
}

function barColor(v) {
  return v >= 75 ? LEVELS.Critical.color : v >= 50 ? LEVELS.High.color : v >= 25 ? LEVELS.Moderate.color : LEVELS.Low.color
}

function Overview({ assessments, onSelect }) {
  const ranked = [...AREAS].sort((a, b) => assessments[b.id].wpi - assessments[a.id].wpi)
  const counts = ranked.reduce((m, a) => ((m[assessments[a.id].level] = (m[assessments[a.id].level] || 0) + 1), m), {})
  return (
    <>
      <Card title="Catbalogan City overview">
        <p className="text-sm text-slate-600">Click a barangay on the map to see why it is flagged.</p>
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          {Object.keys(LEVELS).map((l) => (
            <div key={l} className="rounded-lg py-1.5" style={{ background: LEVELS[l].bg, color: LEVELS[l].text }}>
              <p className="text-lg font-bold leading-none">{counts[l] || 0}</p>
              <p className="text-[10px] font-semibold uppercase">{l}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Barangays by pressure" right={<Info text={WPI_TIP} />}>
        <ul className="-mx-1">
          {ranked.map((a) => {
            const s = assessments[a.id]
            return (
              <li key={a.id}>
                <button
                  onClick={() => onSelect(a.id)}
                  className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: LEVELS[s.level].color }} />
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="tabular-nums font-semibold">{s.wpi}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
    </>
  )
}

export default function AreaProfile({ area, assessment, assessments, scenarioScores, confidence, actions, reports, onSelect, onOpenReport }) {
  if (!area)
    return (
      <aside className="flex flex-col gap-3 p-3">
        <Overview assessments={assessments} onSelect={onSelect} />
      </aside>
    )

  const { scores, wpi, level, verified } = assessment
  const here = reports.filter((r) => r.area_id === area.id)
  const pending = here.filter((r) => !r.archived_at && (r.status === 'Submitted' || r.status === 'Under Barangay Review'))
  const evidence = here.filter((r) => isEvidence(r))
  const rip = area.riparian
  const ripPct = riparianDisturbedPct(area)

  return (
    <aside className="flex flex-col gap-3 p-3">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Area profile · {area.id}</p>
            <h2 className="text-lg font-bold leading-tight text-slate-900">{area.name}</h2>
          </div>
          <button onClick={() => onSelect(null)} aria-label="Close area profile" className="rounded-md px-2 py-0.5 text-lg text-slate-400 hover:bg-slate-100">
            ×
          </button>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              Watershed Pressure Index <Info text={WPI_TIP} />
            </p>
            <p className="text-4xl font-bold tabular-nums leading-none text-slate-900">
              {wpi} <span className="text-base font-medium text-slate-400">/ 100</span>
            </p>
          </div>
          <LevelBadge level={level} suffix=" pressure" />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          Planning indicator. Prototype weights are configurable and require validation by environmental experts before
          operational deployment.
        </p>
      </Card>

      <Card title="Risk drivers" right={<span className="text-[10px] text-slate-400">score · weight</span>}>
        <ul className="space-y-2">
          {DRIVERS.map((d) => {
            const v = Math.round(scores[d.key])
            const sv = scenarioScores ? Math.round(scenarioScores[d.key]) : v
            return (
              <li key={d.key}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{d.label}</span>
                  <span className="tabular-nums text-slate-500">
                    <b className="text-slate-900">{v}</b>
                    {sv !== v && <span className="text-orange-700"> → {sv}</span>} · {Math.round(WEIGHTS[d.key] * 100)}%
                  </span>
                </div>
                <div className="relative mt-1 h-2 rounded-full bg-slate-100" role="img" aria-label={`${d.label} ${v} out of 100`}>
                  <div className="h-2 rounded-full" style={{ width: `${v}%`, background: barColor(v) }} />
                  {sv !== v && <div className="absolute -top-0.5 h-3 w-0.5 bg-slate-900" style={{ left: `${sv}%` }} title={`Scenario: ${sv}`} />}
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      {(() => {
        const hz = hazardParts(area)
        if (!hz.shares) return null
        const pct = Math.round(NORMS.hazardBlend * 100)
        return (
          <Card title="Hazard exposure" right={<span className="text-[10px] font-semibold text-brand-700">official data</span>}>
            <div className="space-y-2.5">
              <Shares kind="flood" shares={hz.shares.flood} />
              <Shares kind="landslide" shares={hz.shares.landslide} />
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
              <b className="text-slate-800">How this enters the index.</b> Slope &amp; Landslide = {100 - pct}% slope score ({Math.round(hz.slope)}, sample
              value) + {pct}% NOAH landslide exposure ({Math.round(hz.landslide)}). Rainfall &amp; Flood = {100 - pct}% rainfall score (
              {Math.round(hz.rain)}, sample value) + {pct}% NOAH flood exposure ({Math.round(hz.flood)}). The hazard layers replace part of
              existing drivers, so they are not counted twice.
            </p>
          </Card>
        )
      })()}

      <Card title="Area facts">
        <dl className="grid grid-cols-2 gap-1.5">
          <Stat label="Forest" value={`${area.forest_pct}%`} />
          <Stat label="Agriculture" value={`${area.farmland_pct}%`} />
          <Stat label="Settlement" value={`${area.settlement_pct}%`} />
          <Stat label="Population" value={area.population.toLocaleString()} />
          <Stat label="Mean slope" value={`${area.mean_slope}°`} />
          <Stat label="Rainfall" value={`${area.rainfall_mm.toLocaleString()} mm/yr`} />
          <Stat label="Riparian disturbance" value={`${Math.round(ripPct)}%`} />
          <Stat label="Verified reports" value={verified} />
        </dl>
        <div className="mt-2.5 rounded-lg border border-slate-200 p-2.5 text-[11px] leading-relaxed text-slate-600">
          <p className="font-semibold text-slate-800">How riparian disturbance is measured</p>
          {rip.buffer_m} m buffer along {area.stream_km} km of mapped streams ≈ <b>{rip.buffer_km2} km²</b>. Inside it:
          agriculture {((rip.agri_pct / 100) * rip.buffer_km2).toFixed(2)} km² ({rip.agri_pct}%), settlements{' '}
          {((rip.settlement_pct / 100) * rip.buffer_km2).toFixed(2)} km² ({rip.settlement_pct}%), other disturbed land{' '}
          {rip.other_disturbed_pct}% → <b>{Math.round(ripPct)}% disturbed</b>.
        </div>
      </Card>

      <Card title="Community evidence">
        <p className="text-sm text-slate-700">
          <b>{evidence.length}</b> verified, open report{evidence.length === 1 ? '' : 's'} count toward the index.
          {pending.length > 0 && (
            <>
              {' '}
              <b>{pending.length}</b> awaiting review {pending.length === 1 ? 'is' : 'are'} <i>not</i> counted.
            </>
          )}
        </p>
        {[...evidence, ...pending].length > 0 && (
          <ul className="mt-2 space-y-1">
            {[...evidence, ...pending].map((r) => (
              <li key={r.id}>
                <button onClick={() => onOpenReport(r)} className="flex w-full justify-between gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-slate-50">
                  <span className="truncate">{r.id} · {r.category.replace(/_/g, ' ')}</span>
                  <span className={isEvidence(r) ? 'font-semibold text-green-700' : 'text-slate-400'}>{r.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-slate-500">Reports are community observations; they inform prioritisation and do not by themselves establish cause.</p>
      </Card>

      <Card title="Recommended actions" right={<span className="text-[10px] text-slate-400">rule-based</span>}>
        <div className="space-y-2">
          {actions.map((a) => (
            <ActionCard key={a.id} a={a} />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Suggested interventions for the LGU to investigate first — not automated decisions.</p>
      </Card>

      <Card title="Data confidence">
        <p className="text-2xl font-bold tabular-nums text-slate-900">
          {confidence.score}% <span className="text-sm font-semibold uppercase text-slate-500">— {confidence.level}</span>
        </p>
        <table className="mt-2 w-full text-xs">
          <tbody>
            {confidence.items.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-1 pr-2 text-slate-700">
                  {i.layer.replace(/ \(.*/, '')}
                  {i.gap && <span className="ml-1 rounded bg-red-50 px-1 text-[10px] font-semibold text-red-700">gaps</span>}
                  {i.sample && <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">sample values</span>}
                </td>
                <td className="py-1 pr-2 tabular-nums text-slate-500">{i.year}</td>
                <td className={`py-1 text-right font-semibold ${i.level === 'High' ? 'text-green-700' : i.level === 'Medium' ? 'text-amber-700' : 'text-red-700'}`}>
                  {i.level}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          Rated on what is loaded today. Indicators still running on sample values are held at Low or Medium until official data replaces them; see Data Sources.
        </p>
        <p className="mt-2 rounded-md bg-amber-50 p-2 text-[11px] leading-snug text-amber-900">
          Prototype note: indicator values are illustrative placeholders, and this score is computed from demo metadata for the
          planned datasets (age, source authority, resolution, gaps). <a className="font-semibold underline" href="#/data">See Data Sources</a>
        </p>
      </Card>
    </aside>
  )
}
