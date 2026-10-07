import { Card } from '../components/ui'
import { DATA_SOURCES } from '../lib/sources'
import { DRIVERS, NORMS, WEIGHTS } from '../lib/wpi'

const STATUS = {
  real: ['Loaded from source', 'bg-green-50 text-green-800 ring-green-200'],
  derived: ['Partly derived', 'bg-blue-50 text-blue-800 ring-blue-200'],
  placeholder: ['Placeholder', 'bg-amber-50 text-amber-800 ring-amber-200'],
}

const METHOD = {
  forest: 'Shortfall of current forest cover against the expected forest cover for the unit, as a percentage.',
  slope: `Half from mean slope (sample value) mapped through prototype breakpoints (${NORMS.slopeBreaks.map(([d, v]) => `${d}° → ${v}`).join(', ')}); half from Project NOAH landslide hazard exposure (% of the unit that is low, medium or high hazard, weighted 1/3, 2/3 and 1; ${NORMS.landslideMax} = 100).`,
  rainfall: `Half from annual rainfall (sample value) scaled from ${NORMS.rainfallMm[0]} mm (0) to ${NORMS.rainfallMm[1]} mm (100); half from Project NOAH flood hazard exposure (same weighting; ${NORMS.floodMax} = 100).`,
  population: `60% population density (population ÷ area, ${NORMS.densityMax}/km² = 100) + 40% settlement cover (${NORMS.settlementMax}% = 100).`,
  riparian: `Share of the 100 m river buffer under agriculture, settlement or other disturbed land (${NORMS.riparianMax}% disturbed = 100).`,
  reports: `${NORMS.reportPoints} points per report in the unit that a barangay official has verified and that is not yet resolved or closed (capped at 100). Unverified reports add nothing.`,
}

export default function DataPage() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-4 overflow-y-auto p-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Data Sources</h1>
        <p className="my-2 max-w-3xl rounded-md bg-brand-50 p-2.5 text-sm text-slate-700">
          <b>Official hazard data:</b> the flood and landslide layers are Project NOAH hazard maps (UP Resilience Institute), used under the Open Database License (ODbL). The clipped copies in this app are shared under the same licence. Bantay Antiao is not affiliated with or endorsed by Project NOAH.
        </p>
        <p className="max-w-3xl text-sm text-slate-600">
          Every layer on the map is listed here with where it actually comes from in this prototype. Layers marked{' '}
          <b>Placeholder</b> use illustrative values so the workflow can be demonstrated; the “planned source” column lists
          candidate official datasets that have <b>not</b> yet been loaded.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              {['Layer', 'Source used in this prototype', 'Year', 'Resolution', 'Last updated', 'Quality', 'Status'].map((h) => (
                <th key={h} className="px-3 py-2.5 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATA_SOURCES.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2.5 font-semibold text-slate-900">{s.layer}</td>
                <td className="px-3 py-2.5 text-slate-700">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-slate-300 hover:text-brand-600">
                      {s.organization}
                    </a>
                  ) : (
                    s.organization
                  )}
                  {s.planned && <span className="mt-0.5 block text-xs text-slate-500">Planned source: {s.planned}</span>}
                  {s.note && <span className="mt-0.5 block text-xs text-slate-500">{s.note}</span>}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-slate-600">{s.status === 'placeholder' ? '—' : s.year}</td>
                <td className="px-3 py-2.5 text-slate-600">{s.resolution}</td>
                <td className="px-3 py-2.5 text-slate-600">{s.last_updated}</td>
                <td className="px-3 py-2.5 text-slate-600">{s.quality}</td>
                <td className="px-3 py-2.5">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS[s.status][1]}`}>
                    {STATUS[s.status][0]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="How the Watershed Pressure Index is calculated">
          <p className="rounded-lg bg-slate-50 p-2.5 font-mono text-xs text-slate-800">
            WPI = {DRIVERS.map((d) => `${WEIGHTS[d.key].toFixed(2)}${d.short}`).join(' + ')}
          </p>
          <table className="mt-3 w-full text-xs">
            <tbody>
              {DRIVERS.map((d) => (
                <tr key={d.key} className="border-t border-slate-100 align-top">
                  <td className="w-8 py-1.5 font-mono font-bold text-slate-900">{d.short}</td>
                  <td className="py-1.5 pr-2">
                    <b className="text-slate-800">
                      {d.label} · {Math.round(WEIGHTS[d.key] * 100)}%
                    </b>
                    <span className="block text-slate-600">{METHOD[d.key]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-600">
            Classes: 0–24 Low · 25–49 Moderate · 50–74 High · 75–100 Critical. Each factor is normalised to 0–100.
          </p>
          <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs leading-snug text-amber-900">
            The weights and normalisation ranges are prototype settings (see <code>src/lib/wpi.js</code>). They are
            configurable, are not official local standards, and require validation by environmental experts before
            operational deployment. The index is a planning indicator, not a validated scientific risk model.
          </p>
        </Card>

        <Card title="How Data Confidence is calculated">
          <p className="text-sm text-slate-700">
            For each of the six indicator datasets: <b>40%</b> dataset age, <b>30%</b> source authority, <b>30%</b> spatial
            resolution. An indicator flagged as having gaps in a unit (for example cloud cover or missing census blocks) is
            halved. The area score is the average of the six.
          </p>
          <p className="mt-2 text-sm text-slate-700">75%+ = High · 50–74% = Medium · below 50% = Low.</p>
          <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs leading-snug text-amber-900">
            The age / authority / resolution figures describe the <b>planned</b> datasets. So that the score reflects what is
            loaded today, an indicator still on sample values is capped at 35% (Low), and a partly derived one at 55%
            (Medium). The caps lift as official datasets are loaded.
          </p>
          <h4 className="mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Pre-processing</h4>
          <p className="mt-1 text-sm text-slate-700">
            Geometry and per-unit statistics are prepared ahead of time (<code>npm run gis</code>, standing in for the QGIS
            workflow) and shipped as a small GeoJSON bundle, so the dashboard does no heavy GIS work at load time.
          </p>
        </Card>
      </div>
    </div>
  )
}
