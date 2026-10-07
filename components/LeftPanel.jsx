import { useState } from 'react'
import { DRIVERS } from '../lib/wpi'
import { saveScenario, useStore } from '../lib/store'
import { ActionCard, Card, LevelBadge } from './ui'

const LAYERS = [
  { id: 'flood', label: 'Flood hazard (NOAH)', swatch: 'linear-gradient(90deg,#f2c94c,#f2994a,#eb5757)' },
  { id: 'landslide', label: 'Landslide hazard (NOAH)', swatch: 'linear-gradient(90deg,#f2c94c,#f2994a,#eb5757)' },
  { id: 'stormsurge', label: 'Storm surge hazard (NOAH)', swatch: 'linear-gradient(90deg,#f2c94c,#f2994a,#eb5757)' },
  { id: 'barangays', label: 'Barangay boundaries', swatch: '#475569' },
  { id: 'areas', label: 'Barangays (pressure index)', swatch: 'linear-gradient(90deg,#3f9b5b,#e3b505,#e8772e,#c62828)' },
  { id: 'forest', label: 'Forest cover', swatch: '#166534' },
  { id: 'rivers', label: 'Rivers & streams', swatch: '#0b5cad' },
  { id: 'farms', label: 'Agricultural land', swatch: '#ca8a04' },
  { id: 'settlements', label: 'Settlements', swatch: '#7c3aed' },
  { id: 'terrain', label: 'Terrain / elevation', swatch: 'linear-gradient(90deg,#b7d7a8,#c9a26b,#8d6e63)' },
  { id: 'reports', label: 'Community reports', swatch: '#64748b' },
]

function Slider({ label, value, max, onChange, disabled }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs font-medium text-slate-700">
        <span>{label}</span>
        <span className="tabular-nums text-slate-900">{value} pts</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(+e.target.value)}
        className="mt-1 w-full disabled:opacity-40"
      />
    </label>
  )
}

export default function LeftPanel({ layers, setLayers, area, current, scenario, setScenario, scenarioResult, newActions, role }) {
  const [saved, setSaved] = useState(false)
  // scenarios saved earlier for this barangay, newest first (signed-in accounts only)
  const { scenarios } = useStore()
  const kept = role && area ? (scenarios || []).filter((x) => x.area_id === area.id).slice(-5).reverse() : []
  const active = scenario.toAgri + scenario.toSettlement > 0
  const maxMove = area ? Math.floor(area.forest_pct) : 0
  const delta = scenarioResult ? scenarioResult.wpi - current.wpi : 0

  return (
    <aside className="flex flex-col gap-3 overflow-y-auto p-3 lg:w-[270px] lg:shrink-0">
      {layers && (
      <Card title="GIS Layers">
        <ul className="space-y-1.5">
          {LAYERS.map((l) => (
            <li key={l.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={layers[l.id]}
                  onChange={(e) => setLayers({ ...layers, [l.id]: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: l.swatch }} />
                {l.label}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          Hazard layers are official Project NOAH maps. Forest and agriculture layers shade each unit by a sample land-cover share.
        </p>
      </Card>
      )}

      <Card title="Land-Use Scenario">
        {!area ? (
          <p className="text-sm text-slate-500">Select a barangay on the map to explore a what-if scenario.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              What if forest in <b className="text-slate-800">{area.name}</b> were converted?
            </p>
            <Slider
              label="Forest → Agriculture"
              value={scenario.toAgri}
              max={Math.min(30, maxMove)}
              onChange={(v) => {
                setSaved(false)
                setScenario({ toAgri: v, toSettlement: Math.min(scenario.toSettlement, maxMove - v) })
              }}
            />
            <Slider
              label="Forest → Settlement"
              value={scenario.toSettlement}
              max={Math.min(15, maxMove)}
              onChange={(v) => {
                setSaved(false)
                setScenario({ toSettlement: v, toAgri: Math.min(scenario.toAgri, maxMove - v) })
              }}
            />

            <div className="grid grid-cols-2 gap-2 text-center">
              {[
                ['Current', area, current],
                ['Scenario', scenarioResult.area, scenarioResult],
              ].map(([label, a, res], i) => (
                <div key={label} className={`rounded-lg p-2 ${i && active ? 'bg-brand-50 ring-1 ring-brand-500/30' : 'bg-slate-50'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                  <p className="text-2xl font-bold tabular-nums text-slate-900">
                    <span className="text-xs font-semibold text-slate-500">WPI </span>
                    {res.wpi}
                  </p>
                  <LevelBadge level={res.level} suffix={i && delta > 0 ? ' ↑' : ''} />
                  <dl className="mt-2 space-y-0.5 text-left text-[11px] text-slate-600">
                    {[
                      ['Forest', a.forest_pct],
                      ['Agriculture', a.farmland_pct],
                      ['Settlement', a.settlement_pct],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt>{k}</dt>
                        <dd className="tabular-nums font-medium text-slate-800">{+v.toFixed(1)}%</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>

            {active && (
              <>
                <p className={`text-center text-sm font-bold ${delta > 0 ? 'text-orange-700' : 'text-slate-600'}`}>
                  {delta > 0 ? '+' : ''}
                  {delta} points
                </p>
                <ul className="space-y-0.5 text-[11px] text-slate-600">
                  {DRIVERS.filter((d) => Math.round(scenarioResult.scores[d.key]) !== Math.round(current.scores[d.key])).map((d) => (
                    <li key={d.key} className="flex justify-between">
                      <span>{d.label}</span>
                      <span className="tabular-nums">
                        {Math.round(current.scores[d.key])} → <b className="text-slate-900">{Math.round(scenarioResult.scores[d.key])}</b>
                      </span>
                    </li>
                  ))}
                  <li className="text-slate-400">Slope, rainfall and report scores are unchanged.</li>
                </ul>
                {newActions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-700">Additional actions this scenario would trigger:</p>
                    {newActions.map((a) => (
                      <ActionCard key={a.id} a={a} tag="scenario" />
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setScenario({ toAgri: 0, toSettlement: 0 })}
                    className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Reset
                  </button>
                  {role && (
                  <button
                    disabled={saved}
                    onClick={async () => {
                      await saveScenario({
                        area_id: area.id,
                        forest_change: -(scenario.toAgri + scenario.toSettlement),
                        farmland_change: scenario.toAgri,
                        settlement_change: scenario.toSettlement,
                        original_score: current.wpi,
                        scenario_score: scenarioResult.wpi,
                        created_by: role.user.name,
                      }).catch((e) => alert(e.message))
                      setSaved(true)
                    }}
                    className="flex-1 rounded-md bg-brand-500 px-2 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:bg-slate-300"
                  >
                    {saved ? 'Saved ✓' : 'Save scenario'}
                  </button>
                  )}
                </div>
              </>
            )}
            {role && (
              <p className="text-[11px] leading-snug text-slate-500">
                Saving keeps this what-if for later comparison. It does not change the barangay’s land cover, its index or its recommended actions, which
                always follow the current data.
              </p>
            )}
            {kept.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Saved scenarios</p>
                <ul className="space-y-1">
                  {kept.map((x, i) => (
                    <li key={x.id || `${x.created_at}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
                      <span className="min-w-0">
                        <b className="tabular-nums">WPI {x.original_score} → {x.scenario_score}</b> · forest −{-x.forest_change} (agri +{x.farmland_change}, settlement +{x.settlement_change})
                        <span className="block truncate text-slate-500">
                          {x.created_by || 'Saved'} · {new Date(x.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSaved(true)
                          setScenario({ toAgri: x.farmland_change, toSettlement: x.settlement_change })
                        }}
                        className="shrink-0 rounded border border-slate-300 px-2 py-1 font-semibold hover:bg-white"
                      >
                        Show
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="rounded-md bg-amber-50 p-2 text-[11px] leading-snug text-amber-900">
              ⚠ Scenario estimates are intended for planning comparison and are not hydrological forecasts.
            </p>
          </div>
        )}
      </Card>
    </aside>
  )
}
