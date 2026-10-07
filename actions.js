// Priority Action Engine — transparent rules, no AI. Every recommendation carries its reasons.
import { isEvidence, CATEGORY } from './constants'
import { distanceKm } from './geo'
import { unitHazard } from './hazards'

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 }
const r0 = (v) => Math.round(v)

function hasCluster(reports, n, km) {
  return reports.some((a) => reports.filter((b) => distanceKm(a, b) <= km).length >= n)
}

/**
 * @param area        area attributes (current or scenario)
 * @param scores      driver scores from wpi.driverScores
 * @param reports     all reports
 * @param confidence  result of dataConfidence(area)
 */
export function recommendActions(area, scores, reports, confidence) {
  const out = []
  const evidence = reports.filter((r) => r.area_id === area.id && isEvidence(r))
  const of = (cat) => evidence.filter((r) => r.category === cat)
  const n = (cat) => of(cat).length
  const plural = (k, cat) => `${k} verified ${CATEGORY[cat].label.toLowerCase()} report${k > 1 ? 's' : ''}`

  if (scores.forest > 70) {
    const why = [`Forest Disturbance: ${r0(scores.forest)} (rule: above 70)`, `Forest cover ${area.forest_pct}% vs expected ${area.expected_forest_pct}%`]
    if (n('illegal_clearing')) why.push(plural(n('illegal_clearing'), 'illegal_clearing'))
    out.push({
      id: 'forest-high',
      action: 'Forest Protection Inspection',
      also: ['Reforestation site assessment', 'Assisted natural regeneration'],
      priority: 'High',
      why,
      lead: 'MENRO / DENR-CENRO',
    })
  } else if (scores.forest > 45 || n('illegal_clearing') >= 1) {
    const why = [`Forest Disturbance: ${r0(scores.forest)}`]
    if (n('illegal_clearing')) why.push(plural(n('illegal_clearing'), 'illegal_clearing'))
    out.push({
      id: 'forest-med',
      action: 'Schedule Forest Monitoring Patrol',
      also: ['Validate reported clearing sites on the ground'],
      priority: n('illegal_clearing') >= 2 ? 'High' : 'Medium',
      why,
      lead: 'MENRO / Barangay Bantay Gubat',
    })
  }

  if (scores.riparian > 60) {
    const why = [
      `Riparian Pressure: ${r0(scores.riparian)} (rule: above 60)`,
      `${r0(area.riparian.agri_pct + area.riparian.settlement_pct + area.riparian.other_disturbed_pct)}% of the ${area.riparian.buffer_m} m river buffer is farmed, settled or disturbed`,
    ]
    if (scores.slope > 60) why.push(`High slope pressure (${r0(scores.slope)})`)
    if (n('turbid_water')) why.push(plural(n('turbid_water'), 'turbid_water'))
    out.push({
      id: 'riparian-high',
      action: 'Restore Riparian Vegetation',
      also: ['Inspect river-buffer encroachment', 'Establish riparian protection zones'],
      priority: 'High',
      why,
      lead: 'MENRO / Barangay',
    })
  } else if (scores.riparian > 40) {
    out.push({
      id: 'riparian-med',
      action: 'Inspect River-Buffer Condition',
      also: ['Map encroachment hotspots along the main channel'],
      priority: 'Medium',
      why: [`Riparian Pressure: ${r0(scores.riparian)} (rule: above 40)`],
      lead: 'MENRO / Barangay',
    })
  }

  if (scores.slope > 60 && area.farmland_pct >= 25) {
    out.push({
      id: 'slope-agri',
      action: 'Promote Contour Farming',
      also: ['Vegetative strips on sloping farms', 'Erosion-control practices'],
      priority: n('erosion') ? 'High' : 'Medium',
      why: [
        `Slope Pressure: ${r0(scores.slope)} (mean slope ${area.mean_slope}°)`,
        `Agricultural land: ${r0(area.farmland_pct)}% (rule: 25% or more on steep terrain)`,
        ...(n('erosion') ? [plural(n('erosion'), 'erosion')] : []),
      ],
      lead: 'Municipal Agriculture Office / MENRO',
    })
  }

  if (n('waste_dumping') >= 3 && hasCluster(of('waste_dumping'), 3, 2)) {
    out.push({
      id: 'waste-cluster',
      action: 'Waste-Source Investigation',
      also: ['Barangay cleanup drive', 'Water-quality inspection downstream'],
      priority: 'High',
      why: [`${n('waste_dumping')} verified waste reports within 2 km of each other`],
      lead: 'MENRO / Barangay / Rural Health Unit',
    })
  }

  if (n('turbid_water') >= 1 && scores.riparian <= 60) {
    out.push({
      id: 'water-quality',
      action: 'Water-Quality Inspection',
      also: ['Trace upstream sediment sources'],
      priority: 'Medium',
      why: [plural(n('turbid_water'), 'turbid_water')],
      lead: 'MENRO / Water District',
    })
  }

  const hazard = n('flooding') + n('river_obstruction')
  if (hazard >= 2) {
    out.push({
      id: 'channel',
      action: 'Channel & Drainage Assessment',
      also: ['Clear reported river obstructions', 'Review flood-prone sitios with MDRRMO'],
      priority: 'High',
      why: [`${hazard} verified flooding / river-obstruction reports`],
      lead: 'MDRRMO / Municipal Engineering',
    })
  }

  if (n('drying_spring') >= 1) {
    out.push({
      id: 'spring',
      action: 'Spring-Source Protection Check',
      also: ['Inspect recharge-area land cover'],
      priority: 'Medium',
      why: [plural(n('drying_spring'), 'drying_spring')],
      lead: 'MENRO / Barangay Water Association',
    })
  }

  if (scores.population > 60) {
    out.push({
      id: 'settlement',
      action: 'Review Settlement Expansion Zoning',
      also: ['Check easement compliance near waterways'],
      priority: 'Medium',
      why: [`Population Pressure: ${r0(scores.population)} (rule: above 60)`, `Settlement cover ${r0(area.settlement_pct)}%`],
      lead: 'MPDO / Barangay',
    })
  }

  // Rules on official Project NOAH hazard shares (% of the unit in each class)
  const hz = unitHazard(area.id)
  if (hz) {
    const [, lsMed, lsHigh] = hz.landslide
    const [, flMed, flHigh] = hz.flood
    if (lsHigh >= 15 && (scores.forest > 45 || area.farmland_pct >= 25)) {
      out.push({
        id: 'noah-landslide',
        action: 'Prioritise Reforestation and Erosion Control on High Landslide-Hazard Slopes',
        also: ['Field-check cleared or farmed slopes inside the NOAH high-hazard zone', 'Keep new dwellings out of high-hazard areas'],
        priority: lsHigh >= 30 || n('erosion') + n('landslide') > 0 ? 'High' : 'Medium',
        why: [
          `Project NOAH: ${lsHigh}% of this unit is high landslide hazard, ${lsMed}% medium`,
          scores.forest > 45 ? `Forest Disturbance: ${r0(scores.forest)}` : `Agricultural land: ${r0(area.farmland_pct)}%`,
          ...(n('erosion') + n('landslide') ? [`${n('erosion') + n('landslide')} verified erosion / landslide report(s)`] : []),
        ],
        lead: 'MENRO / DENR-CENRO / MDRRMO',
      })
    }
    if (flHigh >= 15 && (area.settlement_pct >= 4 || scores.population > 40)) {
      out.push({
        id: 'noah-flood',
        action: 'Review Flood Preparedness for Settlements in the High Flood-Hazard Zone',
        also: ['Check evacuation routes and river easements', 'Monitor the river corridor during heavy rain'],
        priority: flHigh >= 25 || n('flooding') > 0 ? 'High' : 'Medium',
        why: [
          `Project NOAH (100-year rain return): ${flHigh}% of this unit is high flood hazard, ${flMed}% medium`,
          `Settlement cover ${r0(area.settlement_pct)}%, population pressure ${r0(scores.population)}`,
          ...(n('flooding') ? [plural(n('flooding'), 'flooding')] : []),
        ],
        lead: 'MDRRMO / MPDO / Barangay',
      })
    }
  }

  if (confidence && confidence.score < 65) {
    out.push({
      id: 'data',
      action: 'Update Baseline Data Before Committing Resources',
      also: confidence.items.filter((i) => i.gap).map((i) => `Fill gaps: ${i.layer}`),
      priority: 'Low',
      why: [`Data Confidence: ${confidence.score}% (${confidence.level})`],
      lead: 'MPDO / MENRO',
    })
  }

  if (!out.length) {
    out.push({
      id: 'routine',
      action: 'Continue Routine Monitoring',
      also: [],
      priority: 'Low',
      why: ['No pressure driver is above its action threshold'],
      lead: 'MENRO',
    })
  }
  return out.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}
