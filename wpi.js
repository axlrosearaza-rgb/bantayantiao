// Watershed Pressure Index (WPI) — a transparent, rule-based planning indicator.
// Prototype weights and normalisation ranges are configurable and require validation
// by environmental experts before operational use.
import { isEvidence } from './constants'
import { exposureScore, unitHazard } from './hazards'

export const WEIGHTS = {
  forest: 0.25,
  slope: 0.2,
  rainfall: 0.15,
  population: 0.15,
  riparian: 0.15,
  reports: 0.1,
}

export const DRIVERS = [
  { key: 'forest', label: 'Forest Disturbance', short: 'F' },
  { key: 'slope', label: 'Slope & Landslide Hazard', short: 'S' },
  { key: 'rainfall', label: 'Rainfall & Flood Hazard', short: 'R' },
  { key: 'population', label: 'Population Pressure', short: 'P' },
  { key: 'riparian', label: 'Riparian Pressure', short: 'W' },
  { key: 'reports', label: 'Verified Reports', short: 'C' },
]

// Prototype normalisation settings (not official local standards).
export const NORMS = {
  slopeBreaks: [
    [0, 0],
    [8, 25],
    [18, 50],
    [30, 75],
    [45, 100],
  ],
  rainfallMm: [1500, 4000],
  densityMax: 4000, // persons / km² mapped to 100 (city setting)
  settlementMax: 20, // % settlement cover mapped to 100
  riparianMax: 60, // % of buffer disturbed mapped to 100
  reportPoints: 20, // points per verified, unresolved report
  // Project NOAH hazard exposure (weighted % of the unit: low 1/3, medium 2/3, high 1) mapped to 100
  landslideMax: 70,
  floodMax: 40,
  hazardBlend: 0.5, // share of the slope / rainfall drivers that comes from the NOAH layer
}

const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v))

export function slopeScore(deg) {
  const b = NORMS.slopeBreaks
  for (let i = 1; i < b.length; i++) {
    if (deg <= b[i][0]) return b[i - 1][1] + ((deg - b[i - 1][0]) / (b[i][0] - b[i - 1][0])) * (b[i][1] - b[i - 1][1])
  }
  return 100
}

export const riparianDisturbedPct = (a) =>
  clamp(a.riparian.agri_pct + a.riparian.settlement_pct + a.riparian.other_disturbed_pct)

export function evidenceCount(areaId, reports) {
  return reports.filter((r) => r.area_id === areaId && isEvidence(r)).length
}

/**
 * Terrain and rainfall components behind the two hazard-related drivers.
 * NOAH landslide hazard already reflects slope, and NOAH flood hazard already reflects rainfall,
 * so each is blended INTO the existing driver (same weight) instead of being added as a new term.
 * That keeps the hazard evidence from being counted twice.
 */
export function hazardParts(a) {
  const h = unitHazard(a.id)
  const slope = clamp(slopeScore(a.mean_slope))
  const rain = clamp(((a.rainfall_mm - NORMS.rainfallMm[0]) / (NORMS.rainfallMm[1] - NORMS.rainfallMm[0])) * 100)
  const landslide = h ? exposureScore(h.landslide, NORMS.landslideMax) : null
  const flood = h ? exposureScore(h.flood, NORMS.floodMax) : null
  const mix = (base, noah) => (noah === null ? base : (1 - NORMS.hazardBlend) * base + NORMS.hazardBlend * noah)
  return { slope, rain, landslide, flood, slopeDriver: mix(slope, landslide), rainDriver: mix(rain, flood), shares: h }
}

/** Driver scores (each 0–100) for an area's attributes. */
export function driverScores(a, verifiedCount = 0) {
  const density = a.population / a.area_km2
  const hz = hazardParts(a)
  return {
    forest: clamp(((a.expected_forest_pct - a.forest_pct) / a.expected_forest_pct) * 100),
    slope: clamp(hz.slopeDriver),
    rainfall: clamp(hz.rainDriver),
    population: clamp(
      0.6 * clamp((density / NORMS.densityMax) * 100) + 0.4 * clamp((a.settlement_pct / NORMS.settlementMax) * 100),
    ),
    riparian: clamp((riparianDisturbedPct(a) / NORMS.riparianMax) * 100),
    reports: clamp(verifiedCount * NORMS.reportPoints),
  }
}

export function wpiFrom(scores) {
  return Object.keys(WEIGHTS).reduce((sum, k) => sum + WEIGHTS[k] * scores[k], 0)
}

export function classify(score) {
  if (score < 25) return 'Low'
  if (score < 50) return 'Moderate'
  if (score < 75) return 'High'
  return 'Critical'
}

export function assess(a, reports) {
  const verified = evidenceCount(a.id, reports)
  const scores = driverScores(a, verified)
  const wpi = Math.round(wpiFrom(scores))
  return { scores, wpi, level: classify(wpi), verified }
}

/**
 * Land-use scenario: move percentage points of forest to agriculture / settlement.
 * Only the indicators that logically depend on land cover are recalculated
 * (forest, population/settlement, riparian). Slope, rainfall and reports are unchanged.
 * Assumption: the same share of land is converted inside the river buffer.
 */
export function applyScenario(a, { toAgri = 0, toSettlement = 0 }) {
  const moved = Math.min(a.forest_pct, toAgri + toSettlement)
  const k = toAgri + toSettlement ? moved / (toAgri + toSettlement) : 0
  const dAgri = toAgri * k
  const dSet = toSettlement * k
  const intact = 100 - riparianDisturbedPct(a)
  const ripScale = Math.min(1, intact / Math.max(moved, 0.0001))
  return {
    ...a,
    forest_pct: +(a.forest_pct - moved).toFixed(1),
    farmland_pct: +(a.farmland_pct + dAgri).toFixed(1),
    settlement_pct: +(a.settlement_pct + dSet).toFixed(1),
    riparian: {
      ...a.riparian,
      agri_pct: a.riparian.agri_pct + dAgri * ripScale,
      settlement_pct: a.riparian.settlement_pct + dSet * ripScale,
    },
  }
}
