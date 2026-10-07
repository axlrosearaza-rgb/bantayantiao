// The hazard map and the risk analysis as one unit, used by the public Explore Map and the signed-in dashboard.
//   Top:    the Project NOAH-style 3D map (HazardLevels).
//   Below:  the risk analysis for the barangay the pin is in: Watershed Pressure Index (WPI), its drivers,
//           recommended actions and a what-if land-use scenario. The same map can be coloured by the index.
import { useMemo, useRef, useState } from 'react'
import { recommendActions } from '../lib/actions'
import { LEVELS } from '../lib/constants'
import { AREA, AREAS, areaAt } from '../lib/geo'
import { BARANGAY } from '../lib/hazards'
import { dataConfidence } from '../lib/sources'
import { applyScenario, assess, classify, driverScores, wpiFrom } from '../lib/wpi'
import AreaProfile from './AreaProfile'
import HazardLevels from './HazardLevels'
import LeftPanel from './LeftPanel'

const NO_SCENARIO = { toAgri: 0, toSettlement: 0 }
const NO_REPORTS = []

/**
 * @param mapClass      wrapper class of the map (sets its height on each page)
 * @param reports       every report the viewer's data includes: verified ones count toward the index
 * @param listReports   reports the viewer may open: drawn as dots on the map and listed per barangay
 * @param onOpenReport  called with a report id when one is opened
 * @param role          the signed-in role, or null for the public (who cannot save a scenario)
 * @param between       optional content placed between the map and the analysis
 */
export default function HazardRiskMap({ mapClass, reports = NO_REPORTS, listReports = null, onOpenReport, role = null, between = null }) {
  const top = useRef(null)
  const [selectedId, setSelectedId] = useState(null)
  const [scenario, setScenario] = useState(NO_SCENARIO)
  const [goTo, setGoTo] = useState(null)
  const [showIndex, setShowIndex] = useState(false)
  // the analysis follows the map's pin
  const onPin = (lat, lng) => {
    const id = areaAt(lat, lng) || null
    setSelectedId((cur) => {
      if (cur !== id) setScenario(NO_SCENARIO)
      return id
    })
  }
  // choosing a barangay in the ranking moves the pin there
  const select = (id) => {
    const centre = BARANGAY[id]?.center
    if (centre) setGoTo({ lat: centre[0], lng: centre[1] })
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const assessments = useMemo(() => Object.fromEntries(AREAS.map((a) => [a.id, assess(a, reports)])), [reports])
  const pressure = useMemo(() => (showIndex ? Object.fromEntries(AREAS.map((a) => [a.id, LEVELS[assessments[a.id].level].color])) : null), [showIndex, assessments])
  const area = selectedId ? AREA[selectedId] : null
  const current = area ? assessments[area.id] : null
  const confidence = useMemo(() => (area ? dataConfidence(area) : null), [area])
  const actions = useMemo(() => (area ? recommendActions(area, current.scores, reports, confidence) : []), [area, current, reports, confidence])
  const scenarioActive = scenario.toAgri + scenario.toSettlement > 0
  const scenarioResult = useMemo(() => {
    if (!area) return null
    const sArea = applyScenario(area, scenario)
    const scores = driverScores(sArea, current.verified)
    const wpi = Math.round(wpiFrom(scores))
    return { area: sArea, scores, wpi, level: classify(wpi) }
  }, [area, scenario, current])
  const newActions = useMemo(() => {
    if (!scenarioActive || !area) return []
    const have = new Set(actions.map((a) => a.id))
    return recommendActions(scenarioResult.area, scenarioResult.scores, reports, confidence).filter((a) => !have.has(a.id))
  }, [scenarioActive, area, actions, scenarioResult, reports, confidence])

  return (
    <>
      <div className={mapClass} ref={top}>
        <HazardLevels reports={listReports} onOpenReport={onOpenReport} onPin={onPin} goTo={goTo} pressure={pressure} />
      </div>

      {between}

      <section className="risk border-t border-slate-200 bg-slate-50" id="risk" aria-labelledby="risk-title">
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
          <div>
            <h2 id="risk-title" className="text-lg font-bold text-slate-900">
              Risk analysis{area ? `: ${area.name}` : ''}
            </h2>
            <p className="max-w-3xl text-sm text-slate-600">
              {area
                ? 'For the barangay the pin is in. Drag the pin on the map, or pick a barangay from the ranking, to analyse another one.'
                : 'Put the pin inside a barangay on the map, or pick one from the ranking below, to see its pressure index, the reasons behind it and suggested actions.'}{' '}
              The index is a prototype indicator built partly on sample values, not official hazard data.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-800">
              <input type="checkbox" className="h-4 w-4" checked={showIndex} onChange={(e) => setShowIndex(e.target.checked)} />
              Colour the map by pressure index
            </label>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
              {Object.entries(LEVELS).map(([name, l]) => (
                <span key={name} className="inline-flex items-center gap-1">
                  <i className="inline-block h-3 w-3 rounded-sm" style={{ background: l.color }} />
                  {name}
                </span>
              ))}
            </p>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row">
          <LeftPanel area={area} current={current} scenario={scenario} setScenario={setScenario} scenarioResult={scenarioResult} newActions={newActions} role={role} />
          <div className="min-w-0 flex-1">
            <AreaProfile
              area={area}
              assessment={current}
              assessments={assessments}
              scenarioScores={scenarioActive ? scenarioResult.scores : null}
              confidence={confidence}
              actions={actions}
              reports={listReports || NO_REPORTS}
              onSelect={select}
              onOpenReport={(r) => onOpenReport?.(r.id)}
            />
          </div>
        </div>
      </section>
    </>
  )
}
