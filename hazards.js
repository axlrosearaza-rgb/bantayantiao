// Project NOAH hazard layers (official data, ODbL) + barangay lookup + place search.
// The rasters are produced by scripts/build-hazards.mjs; nothing here is simulated.
import hz from '../data/hazards.json'
import admin from '../data/admin.json'
import gis from '../data/gis.json'
import floodUrl from '../assets/hazard-flood.png'
import landslideUrl from '../assets/hazard-landslide.png'
import stormsurgeUrl from '../assets/hazard-stormsurge.png'
import allUrl from '../assets/hazard-all.png'

export const NOAH = hz.meta.noah
export const BOUNDARY_SOURCE = admin.meta
export const HAZARD_GRID = hz.grid
export const HAZARD_BOUNDS = [
  [hz.grid.south, hz.grid.west],
  [hz.grid.north, hz.grid.east],
]
const URLS = { flood: floodUrl, landslide: landslideUrl, stormsurge: stormsurgeUrl }
const rgb = (c) => `rgb(${c.join(',')})`
export const HAZARD_LAYERS = Object.fromEntries(
  Object.entries(hz.layers).map(([id, l]) => [
    id,
    { id, label: l.label, short: l.short, url: URLS[id], classes: l.classes.map((c) => ({ ...c, css: rgb(c.color) })) },
  ]),
)
/** One image holding the highest class of all hazards: cheaper to draw than three stacked layers. */
export const HAZARD_ALL_URL = allUrl

// The same pictures cut into pieces for the 3D map, which can only draw an image inside one map tile
// (see "map pieces" in scripts/build-hazards.mjs).
const PIECE_URLS = import.meta.glob('../assets/hz/*.png', { eager: true, query: '?url', import: 'default' })
/** Corner coordinates of each piece: top-left, top-right, bottom-right, bottom-left. */
export const HAZARD_PIECES = hz.pieces.map((b) => [
  [b.west, b.north],
  [b.east, b.north],
  [b.east, b.south],
  [b.west, b.south],
])
/** Image URL of every piece of a picture: 'all', a hazard id, or 'sim-heavy' / 'sim-veryheavy' / 'sim-extreme'. */
export const hazardPieces = (name) => hz.pieces.map((_, k) => PIECE_URLS[`../assets/hz/${name}-${k}.png`])
export const HAZARD_KINDS = Object.keys(HAZARD_LAYERS)
export const CLASS_NAME = ['None mapped', 'Low', 'Medium', 'High']
export const WATERSHED_HAZARD = hz.watershed
export const STUDY_CENTER = gis.center // [lat, lng] of the city centre

// the management units are the barangays, so boundaries come from the base GIS bundle
const GEOMETRY = Object.fromEntries(gis.areas.features.map((f) => [f.properties.id, f.geometry]))
export const BARANGAYS = admin.barangays.map((b) => ({ ...b, geometry: GEOMETRY[b.id] }))
export const STUDY_AREA = gis.study_area
export const BARANGAY = Object.fromEntries(BARANGAYS.map((b) => [b.id, b]))
export const MUNICIPALITIES = [...new Set(BARANGAYS.map((b) => b.municipality))].sort()
/** A point inside a barangay, for placing a pin when only the barangay is known: its centre, or a sample point if the centre falls outside its outline. */
export function barangayPoint(id) {
  const b = BARANGAY[id]
  if (!b) return null
  const inside = (lat, lng) => barangayAt(lat, lng)?.id === id
  const [lat, lng] = b.center && inside(b.center[0], b.center[1]) ? b.center : (gis.samplePoints?.[id] || []).find(([y, x]) => inside(y, x)) || b.center
  return { lat, lng }
}
export const barangayLabel = (b) => (b ? `${b.name}, ${b.municipality}` : 'Unknown barangay')

/** [low, medium, high] % of a management unit covered by each NOAH hazard class. */
export const unitHazard = (areaId) => admin.units[areaId]

/**
 * 0–100 exposure score from hazard shares: each % of area counts 1/3 (low), 2/3 (medium) or 1 (high).
 * `max` is the weighted share that maps to 100 (a prototype normalisation setting).
 */
export function exposureScore([low, medium, high], max) {
  return Math.min(100, ((low / 3 + (medium * 2) / 3 + high) / max) * 100)
}

function inRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
/** Barangay whose (indicative) boundary contains the point. A suggestion only: residents confirm it. */
export function barangayAt(lat, lng) {
  return BARANGAYS.find((b) => b.geometry.coordinates.some((p) => inRing(lng, lat, p[0]) && !p.slice(1).some((h) => inRing(lng, lat, h)))) || null
}

// ---- point queries against the rasters ----
let grids = null
let loading = null
function decode(kind) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = hz.grid.width
      c.height = hz.grid.height
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const px = ctx.getImageData(0, 0, c.width, c.height).data
      const key = Object.fromEntries(hz.layers[kind].classes.map((k) => [k.color.join(','), k.cls]))
      const out = new Uint8Array(c.width * c.height)
      for (let i = 0; i < out.length; i++) if (px[i * 4 + 3]) out[i] = key[`${px[i * 4]},${px[i * 4 + 1]},${px[i * 4 + 2]}`] || 0
      resolve(out)
    }
    img.onerror = () => reject(new Error(`Could not load the ${kind} hazard layer.`))
    img.src = HAZARD_LAYERS[kind].url
  })
}
/** Loads both hazard rasters once. Rejects if an image cannot be loaded. */
export function loadHazards() {
  if (!loading) {
    loading = Promise.all(HAZARD_KINDS.map(decode))
      .then((list) => (grids = Object.fromEntries(HAZARD_KINDS.map((k, i) => [k, list[i]]))))
      .catch((e) => {
        loading = null
        throw e
      })
  }
  return loading
}
/** NOAH class at a point: { flood: 0–3, landslide: 0–3 }, or null if outside the processed area / not loaded. */
export function hazardAt(lat, lng) {
  if (!grids) return null
  const col = Math.floor((lng - hz.grid.west) / hz.grid.cell)
  const row = Math.floor((hz.grid.north - lat) / hz.grid.cell)
  if (col < 0 || row < 0 || col >= hz.grid.width || row >= hz.grid.height) return null
  const i = row * hz.grid.width + col
  return Object.fromEntries(HAZARD_KINDS.map((k) => [k, grids[k][i]]))
}

// ---- place search (local index, works offline) ----
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const PLACES = [
  { type: 'watershed', label: STUDY_AREA, sub: 'Whole city', bounds: true },
  ...BARANGAYS.map((b) => ({ type: 'barangay', label: `Barangay ${b.name}`, sub: `${b.municipality}, ${b.province}`, barangay: b.id, lat: b.center[0], lng: b.center[1] })),
  ...gis.settlements.map((s) => ({ type: 'place', label: s.name, sub: `Place (${s.place}), OpenStreetMap`, lat: s.lat, lng: s.lng })),
  ...(gis.facilities || []).map((f) => ({ type: 'place', label: f.name, sub: `${f.type.replace(/_/g, ' ')}, OpenStreetMap`, lat: f.lat, lng: f.lng })),
  ...[...new Set(gis.rivers.features.map((f) => f.properties.name).filter(Boolean))].map((name) => {
    const line = gis.rivers.features.filter((f) => f.properties.name === name).sort((a, b) => b.geometry.coordinates.length - a.geometry.coordinates.length)[0].geometry.coordinates
    const [lng, lat] = line[Math.floor(line.length / 2)]
    return { type: 'place', label: name, sub: 'Waterway, OpenStreetMap', lat, lng }
  }),
].map((p) => ({ ...p, key: norm(`${p.label} ${p.sub}`), name: norm(p.label.replace(/^Barangay /, '')) }))

/** Ranked matches: names starting with the query first, then names containing it, then other fields. */
export function searchPlaces(query, limit = 8) {
  const q = norm(query)
  if (!q) return []
  const rank = (p) => (p.name === q ? 0 : p.name.startsWith(q) ? 1 : p.name.includes(q) ? 2 : p.key.includes(q) ? 3 : 9)
  return PLACES.map((p) => [rank(p), p])
    .filter(([r]) => r < 9)
    .sort((a, b) => a[0] - b[0] || a[1].label.localeCompare(b[1].label))
    .slice(0, limit)
    .map(([, p]) => p)
}
