// "Hazard levels in your area": a tilted 3D map with a draggable pin and a side panel that reads the
// Project NOAH flood, landslide and storm surge class at the pin. Clicking a hazard opens its own view
// (that layer alone, what the level means, nearby critical facilities). Layout modelled on NOAH's
// point-assessment pages; branding and code are Bantay Antiao's. Styles: .kyh in pages/home.css.
//
// Map engine: MapLibre GL (the open-source fork of Mapbox GL) with OpenFreeMap vector tiles, which are
// built from OpenStreetMap data and need no account or key. If the vector style cannot be loaded, a
// flat OpenStreetMap map is used instead.
import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import gis from '../data/gis.json'
import ws from '../data/watershed.json'
import city from '../data/city.json'
import { areaAt } from '../lib/geo'
import { DEM_CREDIT, DEM_TILES, FLAT_STYLE, HAZARD_OPACITY, HILLSHADE, RELIEF, SATELLITE, STYLE_URL, restyle } from '../lib/mapStyle'
import { HAZARD_LAYERS, HAZARD_PIECES, hazardPieces, NOAH, WATERSHED_HAZARD, STUDY_AREA, STUDY_CENTER, barangayAt, hazardAt, loadHazards, searchPlaces, BARANGAYS } from '../lib/hazards'

const VIEW = { zoom: 15.2, pitch: 56, bearing: -24 }
const MODES = [
  { id: 'sat', label: 'Satellite', hint: 'Photo of the land, in 3D' },
  { id: '3d', label: '3D terrain', hint: 'Drawn map with hills' },
  { id: 'flat', label: 'Flat streets', hint: 'Street map from above' },
  { id: 'terrain', label: 'Topographic map', hint: 'Contour lines and heights' },
]
// The map opens on the Antiao Watershed: the view is fitted to the watershed's boundary and the pin starts
// inside it, on the main channel near the middle of its course. Falls back to the city centre.
const RIVER = gis.rivers.features.filter((f) => f.properties.main)
const RIVER_PTS = RIVER.flatMap((f) => f.geometry.coordinates)
const RIVER_BOUNDS = RIVER_PTS.length ? RIVER_PTS.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [180, 90, -180, -90]) : null
// the watershed's extent is what the map is fitted to on opening
const WS_BOUNDS = ws.boundary.geometry.coordinates[0].reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [180, 90, -180, -90])
const WS_LAYERS = ['ws-streams', 'ws-outline-glow', 'ws-outline', 'ws-boundary-glow', 'ws-boundary']
// The boundary drawn on the map is the catchment the pin stands in: one of the main river's parts, or, outside
// its watershed, one of the other catchments, which drain to the sea or out of the city without joining that river.
const MAIN_PARTS = ws.parts.features.filter((f) => f.properties.main).length
const NO_PART = { type: 'FeatureCollection', features: [] }
function partAt(lat, lng) {
  return (
    ws.parts.features.find((f) => {
      const r = f.geometry.coordinates[0]
      let inside = false
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        if (r[i][1] > lat !== r[j][1] > lat && lng < ((r[j][0] - r[i][0]) * (lat - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) inside = !inside
      }
      return inside
    }) || null
  )
}
const HZ_COLORS = ['#f2c94c', '#f2994a', '#eb5757'] // low, medium, high
const START = (() => {
  if (!RIVER_BOUNDS) return { lat: STUDY_CENTER[0], lng: STUDY_CENTER[1] }
  const cx = (RIVER_BOUNDS[0] + RIVER_BOUNDS[2]) / 2
  const cy = (RIVER_BOUNDS[1] + RIVER_BOUNDS[3]) / 2
  const [lng, lat] = RIVER_PTS.reduce((best, pt) => (Math.hypot(pt[0] - cx, pt[1] - cy) < Math.hypot(best[0] - cx, best[1] - cy) ? pt : best))
  return { lat, lng }
})()
const CITY_BOUNDS = gis.boundary.geometry.coordinates
  .flatMap((p) => p[0])
  .reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [180, 90, -180, -90])

const LEVEL = [
  { text: 'LITTLE TO NONE', color: '#1f2937', bar: '#1f2937' },
  { text: 'LOW', color: '#d9a400', bar: '#f2c94c' },
  { text: 'MEDIUM', color: '#e07b1f', bar: '#f2994a' },
  { text: 'HIGH', color: '#e23c3c', bar: '#eb5757' },
]
const TITLE = { flood: 'Flood Hazard Level', landslide: 'Landslide Hazard Level', stormsurge: 'Storm Surge Hazard Level' }
const SCENARIO = {
  flood: 'a 100-year rain event',
  landslide: 'the landslide models',
  stormsurge: 'a storm surge above 4 meters (Storm Surge Advisory 4)',
}
// What each class means, worded from the NOAH metadata that ships with the hazard maps.
const MEANING = {
  flood: [
    'No flooding is modelled at this exact spot for a 100-year rain event. Low ground nearby may still flood, so check the map around the pin.',
    'Flood water up to about knee height (0.5 m) is possible here in a 100-year rain event.',
    'Flood water from about knee to neck height (0.5 m to 1.5 m) is possible here in a 100-year rain event.',
    'Flood water above 1.5 m, higher than an adult’s neck, is possible here in a 100-year rain event. Fast-flowing water can make shallower floods just as dangerous.',
  ],
  landslide: [
    'No landslide hazard is mapped at this exact spot. Check the slopes around the pin on the map.',
    'Low landslide hazard. NOAH’s guidance for this class: build only with continuous monitoring.',
    'Medium landslide hazard. NOAH’s guidance for this class: build only with slope protection and intervention, and continuous monitoring.',
    'High landslide hazard. NOAH classes this as a no-dwelling zone.',
  ],
  stormsurge: [
    'No storm surge flooding is modelled at this exact spot for a surge above 4 meters. Check the coast around the pin on the map.',
    'Sea water 0.2 m to 0.5 m deep is possible here in a storm surge above 4 meters.',
    'Sea water 0.5 m to 1.5 m deep is possible here in a storm surge above 4 meters.',
    'Sea water deeper than 1.5 m is possible here in a storm surge above 4 meters.',
  ],
}
const WHAT_TO_DO = [
  'Know your barangay’s evacuation site and the way to it.',
  'Follow advisories from PAGASA, your barangay and the MDRRMO.',
  'In an emergency call 911 or your local disaster office.',
]
const INCLUDED = ['100-year rain return for floods;', 'Shallow and structurally-controlled landslides and debris flows;', 'Storm surges above 4 meters (Storm Surge Advisory 4).']

// ---- weather simulation ----
// NOAH has flood maps for smaller rain events only in the major river basins, not for Catbalogan. So only the
// "Extreme" step is a modelled scenario (NOAH's 100-year rain flood map). The lighter steps reveal that map in
// stages, on the rule of thumb that ground which floods deepest in the worst case collects water first.
// Drought and light rain use no hazard model at all. The panel says this wherever the simulation is shown.
const BLUE = ['#5b9bf0', '#2f6fdc', '#143fae']
const BROWN = ['#b0845c', '#7a4828']
const QUIET = { text: 'UNLIKELY', color: '#64748b', bar: '#cbd5e1' }
const WEATHER = [
  { id: 'drought', label: 'Drought', title: 'Weeks without rain', image: null },
  { id: 'light', label: 'Light rain', title: 'Ordinary, light rain', image: null },
  { id: 'heavy', label: 'Heavy rain', title: 'Heavy, lasting rain', image: 'sim-heavy' },
  { id: 'veryheavy', label: 'Very heavy', title: 'Very heavy rain', image: 'sim-veryheavy' },
  { id: 'extreme', label: 'Extreme', title: 'Extreme rain (NOAH’s 100-year rain event)', image: 'sim-extreme' },
]
const WEATHER_BY_ID = Object.fromEntries(WEATHER.map((w) => [w.id, w]))
/** What the pin's spot does in each weather, from its class on NOAH's flood (f) and landslide (l) maps. */
const SIM_LEVEL = {
  flood: (w, f) => {
    if (w === 'drought') return { text: 'NO FLOODING', color: '#64748b', bar: '#cbd5e1' }
    if (w === 'light') return { text: 'UNLIKELY TO FLOOD', color: '#64748b', bar: '#cbd5e1' }
    if (w === 'heavy') return f === 3 ? { text: 'FLOODS FIRST', color: BLUE[1], bar: BLUE[1] } : f ? { text: 'MAY POND', color: BLUE[0], bar: BLUE[0] } : { ...QUIET, text: 'UNLIKELY TO FLOOD' }
    if (w === 'veryheavy')
      return f === 3 ? { text: 'DEEP WATER LIKELY', color: BLUE[2], bar: BLUE[2] } : f === 2 ? { text: 'FLOODING LIKELY', color: BLUE[1], bar: BLUE[1] } : f === 1 ? { text: 'MAY FLOOD', color: BLUE[0], bar: BLUE[0] } : { ...QUIET, text: 'UNLIKELY TO FLOOD' }
    return f ? { text: ['', 'UP TO 0.5 M OF WATER', '0.5 M TO 1.5 M OF WATER', 'MORE THAN 1.5 M OF WATER'][f], color: BLUE[f - 1], bar: BLUE[f - 1] } : { ...QUIET, text: 'LITTLE TO NONE' }
  },
  landslide: (w, l) => {
    if (w === 'drought' || w === 'light') return { text: 'NO RAIN TO TRIGGER IT', color: '#64748b', bar: '#cbd5e1' }
    const watch = { text: 'SLOPE TO WATCH', color: BROWN[0], bar: BROWN[0] }
    const likely = { text: 'MOST LIKELY TO FAIL', color: BROWN[1], bar: BROWN[1] }
    if (w === 'heavy') return l === 3 ? watch : QUIET
    return l === 3 ? likely : l === 2 ? watch : QUIET
  },
  stormsurge: () => ({ text: 'NOT PART OF THIS', color: '#94a3b8', bar: '#e2e8f0' }),
}
const STREAM_KM = Math.round(gis.areas.features.reduce((a, f) => a + f.properties.stream_km, 0))

const ICON = {
  flood: (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 21 20 10l12 11v7H8z" fill="#fff" />
      <path d="M17 28v-6h6v6" fill="#1a73e8" />
      <path d="M4 31c3-2.500 5-2.500 8 0s5 2.500 8 0 5-2.500 8 0 5 2.500 8 0" fill="none" stroke="#fff" strokeWidth="2.600" strokeLinecap="round" />
    </svg>
  ),
  landslide: (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M5 33V12l9-5 21 26z" fill="#fff" />
      <circle cx="24" cy="14" r="2.600" fill="#fff" />
      <circle cx="29" cy="20" r="2" fill="#fff" />
      <path d="M22 33v-5l4-3 4 3v5z" fill="#1a73e8" stroke="#fff" strokeWidth="1.500" />
    </svg>
  ),
  stormsurge: (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M5 26c2-11 10-17 19-15-5 1-7 5-5 9 3 5 10 4 12-1 1 9-4 13-11 13H5z" fill="#fff" />
      <path d="M4 34c3-2.500 5-2.500 8 0s5 2.500 8 0 5-2.500 8 0 5 2.500 8 0" fill="none" stroke="#fff" strokeWidth="2.600" strokeLinecap="round" />
    </svg>
  ),
}

// ---- critical facilities (OpenStreetMap) ----
const FACILITY = {
  school: { label: 'School', color: '#1a9e96', glyph: '<path d="M12 4 2 9l10 5 8-4v6h2V9zM6 13v4c2 2 10 2 12 0v-4l-6 3z" fill="#fff"/>' },
  health: { label: 'Health facility', color: '#6a1fb5', glyph: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" fill="#fff"/>' },
  police: { label: 'Police station', color: '#1d4ed8', glyph: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z" fill="#fff"/>' },
  fire: { label: 'Fire station', color: '#dc2626', glyph: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 2 4 4 0-3 0-6 0-9z" fill="#fff"/>' },
  government: { label: 'Government building', color: '#475569', glyph: '<path d="M12 3 3 8v2h18V8zM5 11h2v7H5zm6 0h2v7h-2zm6 0h2v7h-2zM3 19h18v2H3z" fill="#fff"/>' },
}
const FACILITIES = gis.facilities || []
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
function metres(a, b) {
  const kx = 111320 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot((a.lng - b.lng) * kx, (a.lat - b.lat) * 110570)
}
const distanceText = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`)

/**
 * Critical facilities as one map layer. Drawn on the GPU with the rest of the map, which stays smooth
 * on 3D terrain; separate HTML markers have to be re-placed on the ground every frame.
 */
function addFacilities(map) {
  map.addSource('facilities', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: FACILITIES.map((f) => ({ type: 'Feature', properties: { name: f.name, kind: f.kind }, geometry: { type: 'Point', coordinates: [f.lng, f.lat] } })) },
  })
  map.addLayer({
    id: 'facility-dots',
    type: 'circle',
    source: 'facilities',
    minzoom: 13.2,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.2, 5, 16, 10],
      'circle-color': ['match', ['get', 'kind'], ...Object.entries(FACILITY).flatMap(([kind, k]) => [kind, k.color]), '#475569'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })
  let pending = Object.keys(FACILITY).length
  for (const [kind, k] of Object.entries(FACILITY)) {
    const img = new Image(56, 56)
    img.onload = () => {
      if (!map.getStyle()) return // map was removed while the icon loaded
      const state = map.getContainer().dataset // readable status, handy when testing
      if (!map.hasImage(`fac-${kind}`)) map.addImage(`fac-${kind}`, img, { pixelRatio: 2 })
      state.facilityIcons = String(Object.keys(FACILITY).length - (pending - 1))
      if (--pending === 0 && !map.getLayer('facilities')) {
        map.addLayer({
          id: 'facilities',
          type: 'symbol',
          source: 'facilities',
          minzoom: 13.2,
          layout: { 'icon-image': ['concat', 'fac-', ['get', 'kind']], 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        })
        state.facilities = 'ready'
      }
    }
    img.onerror = () => (map.getContainer().dataset.facilities = 'icon-error')
    img.src =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 28 28"><rect x="2" y="2" width="24" height="24" rx="6" fill="${k.color}" stroke="#fff" stroke-width="2"/><g transform="translate(5 5) scale(0.75)">${k.glyph}</g></svg>`)
  }
}

/** Adds the NOAH rasters (and the optional terrain basemap) over the streets and under the 3D buildings and labels. */
function addHazardLayers(map) {
  const layers = map.getStyle().layers
  const before = (layers.find((l) => l.type === 'fill-extrusion') || layers.find((l) => l.type === 'symbol'))?.id
  map.addSource('terrain', {
    type: 'raster',
    tiles: ['a', 'b', 'c'].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
    tileSize: 256,
    maxzoom: 15,
    attribution: 'Terrain: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  })
  map.addLayer({ id: 'terrain', type: 'raster', source: 'terrain', layout: { visibility: 'none' } }, before)
  // satellite picture of the land, under the hazard colours, buildings and labels
  map.addSource('sat', SATELLITE)
  map.addLayer({ id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 0 } }, before)
  // one image for all hazards (swapped for a single hazard's image in the detail view)
  // the hazard picture, in pieces: on 3D terrain an image is only drawn inside one map tile, so a single
  // image covering the city lost everything north of a tile edge
  hazardPieces('all').forEach((url, k) => {
    map.addSource(`hz-${k}`, { type: 'image', url, coordinates: HAZARD_PIECES[k] })
    map.addLayer({ id: `hz-${k}`, type: 'raster', source: `hz-${k}`, paint: { 'raster-opacity': HAZARD_OPACITY.plain, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, before)
  })
  // 3D ground: hills and valleys under the hazard colours, buildings and pins
  map.addSource('dem', {
    type: 'raster-dem',
    tiles: [DEM_TILES],
    tileSize: 256,
    maxzoom: 12, // the source data is about 30 m, so finer tiles add cost without adding detail
    encoding: 'terrarium',
    attribution: DEM_CREDIT,
  })
  map.addSource('dem-shade', { type: 'raster-dem', tiles: [DEM_TILES], tileSize: 256, maxzoom: 12, encoding: 'terrarium' })
  map.addLayer(
    {
      id: 'relief-shade',
      type: 'hillshade',
      source: 'dem-shade',
      paint: HILLSHADE,
    },
    before,
  )
  // shown only in the drought simulation: the mapped waterways, drawn as running low
  map.addSource('streams', { type: 'geojson', data: gis.rivers })
  map.addLayer({ id: 'drought-streams', type: 'line', source: 'streams', layout: { visibility: 'none', 'line-cap': 'round' }, paint: { 'line-color': '#8a5a2b', 'line-width': 3, 'line-dasharray': [1.5, 1.5] } })
  // terrain-derived watershed of the main river: its tributaries, and the divide that bounds it
  map.addSource('ws-streams', { type: 'geojson', data: ws.streams })
  map.addLayer({ id: 'ws-streams', type: 'line', source: 'ws-streams', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1f7ae0', 'line-width': ['match', ['get', 'size'], 4, 3.2, 3, 2.4, 2, 1.7, 1.1], 'line-opacity': 0.95 } })
  // the whole watershed: a solid dark line that is always there
  map.addSource('ws-outline', { type: 'geojson', data: ws.boundary })
  map.addLayer({ id: 'ws-outline-glow', type: 'line', source: 'ws-outline', layout: { 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 7.5, 'line-opacity': 0.85 } })
  map.addLayer({ id: 'ws-outline', type: 'line', source: 'ws-outline', layout: { 'line-join': 'round' }, paint: { 'line-color': '#0a2f5c', 'line-width': 3.6 } })
  // the catchment the pin stands in: a thinner dashed line that moves with the pin
  map.addSource('ws-boundary', { type: 'geojson', data: NO_PART })
  map.addLayer({ id: 'ws-boundary-glow', type: 'line', source: 'ws-boundary', layout: { 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.9 } })
  map.addLayer({ id: 'ws-boundary', type: 'line', source: 'ws-boundary', layout: { 'line-join': 'round' }, paint: { 'line-color': '#111827', 'line-width': 2.2, 'line-dasharray': [2.2, 1.6] } })
  // the main river, drawn over the hazard colours so it can be followed from the hills to the sea
  map.addSource('main-river', { type: 'geojson', data: { type: 'FeatureCollection', features: RIVER } })
  map.addLayer({ id: 'main-river-glow', type: 'line', source: 'main-river', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.7 } })
  map.addLayer({ id: 'main-river', type: 'line', source: 'main-river', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0b5cd0', 'line-width': 3.5 } })
  addFacilities(map)
  // the viewer's own position: a ring as wide as the reading's accuracy, and a dot at its centre
  map.addSource('me', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'me-ring', type: 'fill', source: 'me', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#1a73e8', 'fill-opacity': 0.16, 'fill-outline-color': '#1a73e8' } })
  map.addLayer({ id: 'me-dot', type: 'circle', source: 'me', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#1a73e8', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 } })
  map.addSource('city', { type: 'geojson', data: city.polygon }) // reference outline of the city, see scripts/build-city.mjs
  map.addLayer({ id: 'city-line', type: 'line', source: 'city', paint: { 'line-color': '#0f3d3e', 'line-width': 1.6, 'line-dasharray': [3, 3] } })
}

/**
 * @param reports       optional community reports to show as dots (signed-in dashboard)
 * @param onOpenReport  called with a report id when its dot is clicked
 * @param onPin         called with (lat, lng) whenever the pin moves
 * @param goTo          {lat, lng}: move the pin there and fly to it
 * @param pressure      {barangayId: colour}: colour the barangays (for the pressure index) in place of the hazard colours
 */
export default function HazardLevels({ reports = null, onOpenReport, onPin, goTo = null, pressure = null } = {}) {
  const openReport = useRef(onOpenReport)
  openReport.current = onOpenReport
  const pinMoved = useRef(onPin)
  pinMoved.current = onPin
  const [pin, setPin] = useState(START)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [mapNote, setMapNote] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [detail, setDetail] = useState(null) // null = all three hazards, or one hazard id
  const [mode, setMode] = useState('sat')
  // The combined hazard colours cover most of the city in orange and red, so they start switched off: the map opens
  // as a normal satellite picture. Opening one hazard, or running the simulation, always draws that picture.
  const [showHz, setShowHz] = useState(false)
  const [showWs, setShowWs] = useState(true) // watershed boundary and tributaries on the map
  const [fold, setFold] = useState({ ws: false }) // which panel sections are opened out
  const [styleMenu, setStyleMenu] = useState(false) // the list of map styles
  const [weather, setWeather] = useState(null) // null = the official hazard maps, or a WEATHER id
  const [playing, setPlaying] = useState(false)
  const [info, setInfo] = useState(null)
  const [legend, setLegend] = useState(true)
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const box = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const actions = useRef({})
  const watch = useRef(null) // running location watch: { id, timer }

  useEffect(() => {
    let alive = true
    loadHazards()
      .then(() => alive && setReady(true))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  // ---- map ----
  useEffect(() => {
    let map
    let cancelled = false
    const start = (style, flat) => {
      if (cancelled) return
      map = new maplibregl.Map({
        container: box.current,
        style,
        center: [START.lng, START.lat],
        zoom: VIEW.zoom,
        pitch: flat ? 0 : VIEW.pitch,
        bearing: flat ? 0 : VIEW.bearing,
        maxPitch: 62,
        // very dense screens quadruple the pixels to shade; 1.5 is sharp enough for a map
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        fadeDuration: 0,
        // on phones the page scrolls past the map, so two fingers move the map and one scrolls the page
        cooperativeGestures: matchMedia('(max-width: 900px)').matches,
        attributionControl: { compact: true },
      })
      mapRef.current = map
      map.fitBounds([WS_BOUNDS.slice(0, 2), WS_BOUNDS.slice(2)], { padding: 40, pitch: flat ? 0 : VIEW.pitch, bearing: flat ? 0 : VIEW.bearing, animate: false })
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
      map.addControl(
        {
          onAdd() {
            const el = (this.el = document.createElement('div'))
            el.className = 'maplibregl-ctrl maplibregl-ctrl-group kyh-ctl'
            const button = (label, svg, fn) => {
              const b = document.createElement('button')
              b.type = 'button'
              b.title = label
              b.setAttribute('aria-label', label)
              b.innerHTML = svg
              b.addEventListener('click', fn)
              el.appendChild(b)
            }
            button(
              'Use my location',
              '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
              () => actions.current.locate(),
            )
            button(
              'Map style',
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
              () => actions.current.toggleStyles(),
            )
            return el
          },
          onRemove() {
            this.el.remove()
          },
        },
        'top-right',
      )
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 90 }), 'top-right')

      const marker = new maplibregl.Marker({ draggable: true, color: '#3a3f47', scale: 1.15, opacityWhenCovered: '1' }).setLngLat([START.lng, START.lat]).addTo(map)
      markerRef.current = marker
      marker.getElement().classList.add('kyh-pin') // kept above the facility icons so it can always be grabbed
      marker.on('dragend', () => {
        const p = marker.getLngLat()
        setPin({ lat: p.lat, lng: p.lng })
      })
      const popup = new maplibregl.Popup({ offset: 14, closeButton: false, closeOnClick: false, maxWidth: '240px' })
      map.on('click', (e) => {
        if (e.originalEvent.target.closest?.('.kyh-fac')) return // a raised facility marker handles its own popup
        // a facility icon was clicked: show its name and leave the pin where it is
        // a small box around the click, so a dot is easy to hit with a finger
        const around = [[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]]
        const report = map.getLayer('report-dots') ? map.queryRenderedFeatures(around, { layers: ['report-dots'] })[0] : null
        if (report) return openReport.current?.(report.properties.id) // a report dot opens that report; the pin stays
        const hit = map.getLayer('facility-dots') ? map.queryRenderedFeatures(around, { layers: ['facility-dots'] })[0] : null
        map.getContainer().dataset.lastClick = hit ? 'facility' : 'ground'
        if (hit) {
          popup.setLngLat(hit.geometry.coordinates).setHTML(`<strong>${esc(hit.properties.name)}</strong><br><span>${FACILITY[hit.properties.kind].label}</span>`).addTo(map)
          return
        }
        popup.remove()
        marker.setLngLat(e.lngLat)
        setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      })
      map.on('mousemove', (e) => {
        const over = map.getLayer('facility-dots') && map.queryRenderedFeatures(e.point, { layers: ['facility-dots'] }).length > 0
        map.getCanvas().style.cursor = over ? 'pointer' : ''
      })
      // tell the page background to hold still while the map is being moved
      map.on('movestart', () => (document.documentElement.dataset.mapBusy = '1'))
      map.on('moveend', () => delete document.documentElement.dataset.mapBusy)


      map.on('load', () => {
        addHazardLayers(map)
        setLoaded(true)
      })
      if (flat) setMapNote('The 3D basemap could not be loaded, so a flat map is shown.')
    }
    // fetch the vector style first so an offline or blocked request falls back cleanly
    fetch(STYLE_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((style) => start(restyle(style), false))
      .catch(() => start(FLAT_STYLE, true))
    return () => {
      cancelled = true
      setLoaded(false)
      if (watch.current) {
        navigator.geolocation.clearWatch(watch.current.id)
        clearTimeout(watch.current.timer)
        watch.current = null
      }
      delete document.documentElement.dataset.mapBusy
      map?.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  // which hazard layers are drawn: all three, or only the one being viewed
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    // a hazard's own view always shows NOAH's map; otherwise the simulation picture, if one is running
    // the pressure colours replace the hazard colours; the legend's switch controls the all-hazards picture
    const name = pressure ? null : detail || (weather ? WEATHER_BY_ID[weather].image : showHz ? 'all' : null)
    const urls = name ? hazardPieces(name) : []
    HAZARD_PIECES.forEach((corners, k) => {
      map.setLayoutProperty(`hz-${k}`, 'visibility', name ? 'visible' : 'none')
      if (name) map.getSource(`hz-${k}`)?.updateImage({ url: urls[k], coordinates: corners })
    })
    map.setLayoutProperty('drought-streams', 'visibility', !detail && weather === 'drought' ? 'visible' : 'none')
  }, [detail, weather, loaded, Boolean(pressure), showHz])

  // "Play" walks from drought to extreme rain, one step every few seconds
  useEffect(() => {
    if (!playing) return
    const i = WEATHER.findIndex((w) => w.id === weather)
    if (i === WEATHER.length - 1) return setPlaying(false)
    const t = setTimeout(() => setWeather(WEATHER[i + 1].id), 2600)
    return () => clearTimeout(t)
  }, [playing, weather])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    for (const id of WS_LAYERS) map.setLayoutProperty(id, 'visibility', showWs ? 'visible' : 'none')
  }, [showWs, loaded])

  useEffect(() => {
    pinMoved.current?.(pin.lat, pin.lng)
  }, [pin])
  useEffect(() => {
    if (goTo && loaded) moveTo(goTo.lat, goTo.lng, 13.5)
  }, [goTo, loaded])

  // barangays coloured by a value handed in by the page (the pressure index), under the streams and pins
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    if (!map.getSource('wpi')) {
      if (!pressure) return
      map.addSource('wpi', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'wpi-fill', type: 'fill', source: 'wpi', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0.62 } }, 'ws-streams')
      map.addLayer({ id: 'wpi-line', type: 'line', source: 'wpi', paint: { 'line-color': '#ffffff', 'line-width': 1.2 } }, 'ws-streams')
    }
    for (const id of ['wpi-fill', 'wpi-line']) map.setLayoutProperty(id, 'visibility', pressure ? 'visible' : 'none')
    if (pressure)
      map.getSource('wpi').setData({
        type: 'FeatureCollection',
        features: gis.areas.features.map((f) => ({ type: 'Feature', properties: { c: pressure[f.properties.id] || '#cbd5e1' }, geometry: f.geometry })),
      })
  }, [pressure, loaded])

  // community reports as dots: filled once a barangay official has verified them, hollow before that
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded || !reports) return
    const data = {
      type: 'FeatureCollection',
      features: reports.map((r) => ({ type: 'Feature', properties: { id: r.id, verified: r.verified_at ? 1 : 0 }, geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] } })),
    }
    if (map.getSource('reports')) return map.getSource('reports').setData(data)
    map.addSource('reports', { type: 'geojson', data })
    map.addLayer({
      id: 'report-dots',
      type: 'circle',
      source: 'reports',
      paint: { 'circle-radius': 8, 'circle-color': ['case', ['==', ['get', 'verified'], 1], '#7c3aed', '#ffffff'], 'circle-stroke-color': '#7c3aed', 'circle-stroke-width': 3 },
    })
  }, [reports, loaded])

  // map style: satellite picture on 3D terrain, drawn map on 3D terrain, flat streets, or a flat topographic map
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    const raised = mode === 'sat' || mode === '3d'
    map.setLayoutProperty('terrain', 'visibility', mode === 'terrain' ? 'visible' : 'none')
    map.setLayoutProperty('sat', 'visibility', mode === 'sat' ? 'visible' : 'none')
    // the satellite picture already shows the lie of the land, so the painted relief shading is left off over it
    map.setLayoutProperty('relief-shade', 'visibility', mode === 'sat' ? 'none' : 'visible')
    HAZARD_PIECES.forEach((_, k) => map.setPaintProperty(`hz-${k}`, 'raster-opacity', mode === 'sat' ? HAZARD_OPACITY.satellite : HAZARD_OPACITY.plain))
    // the ground is raised only in the 3D views; the flat views stay truly flat
    map.setTerrain(raised ? { source: 'dem', exaggeration: RELIEF } : null)
    map.easeTo(raised ? { pitch: VIEW.pitch, bearing: VIEW.bearing, duration: 700 } : { pitch: 0, bearing: 0, duration: 700 })
  }, [mode, loaded])

  const moveTo = (lat, lng, zoom = 15.6) => {
    setPin({ lat, lng })
    markerRef.current?.setLngLat([lng, lat])
    mapRef.current?.flyTo({ center: [lng, lat], zoom: Math.max(mapRef.current.getZoom(), zoom), duration: 900 })
  }
  // ---- "use my location" ----
  // One quick reading is often a cached or network guess that can be hundreds of metres off. So we ask for
  // high accuracy, refuse cached readings, and keep listening for a few seconds, moving the pin each time
  // a better fix arrives. The ring on the map and the note show how precise the final reading is.
  const stopWatch = () => {
    if (!watch.current) return
    navigator.geolocation.clearWatch(watch.current.id)
    clearTimeout(watch.current.timer)
    watch.current = null
  }
  const showMe = (lat, lng, acc) => {
    const ring = Array.from({ length: 65 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2
      return [lng + (Math.cos(a) * acc) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (Math.sin(a) * acc) / 110570]
    })
    mapRef.current?.getSource('me')?.setData({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } },
      ],
    })
  }
  const locate = () => {
    if (!('geolocation' in navigator)) return setMapNote('This browser cannot share its location. Drag the pin instead.')
    if (!window.isSecureContext) return setMapNote('Location only works on a secure (https) address or on localhost. Drag the pin instead.')
    stopWatch()
    setMapNote('Finding your location…')
    let best = null
    const finish = () => {
      stopWatch()
      if (!best) return setMapNote('No location reading arrived. Check that location is switched on, or drag the pin.')
      const m = Math.round(best.acc)
      const where = areaAt(best.lat, best.lng) ? '' : ` You are outside ${STUDY_AREA}, so no hazard levels are shown there.`
      setMapNote(
        m <= 30
          ? `Located to within about ${m} m.${where}`
          : m <= 200
            ? `Located to within about ${m} m. Drag the pin if it is not quite on your spot.${where}`
            : `This device can only estimate your position to about ${m >= 1000 ? (m / 1000).toFixed(1) + ' km' : m + ' m'}. A phone with GPS outdoors is far more precise; otherwise drag the pin.${where}`,
      )
    }
    const id = navigator.geolocation.watchPosition(
      (g) => {
        const fix = { lat: g.coords.latitude, lng: g.coords.longitude, acc: g.coords.accuracy || 9999 }
        if (best && fix.acc >= best.acc) return // keep the most precise reading seen so far
        const first = !best
        best = fix
        showMe(fix.lat, fix.lng, fix.acc)
        setPin({ lat: fix.lat, lng: fix.lng })
        markerRef.current?.setLngLat([fix.lng, fix.lat])
        // zoom so the accuracy ring fits: close in for GPS, wider for a rough estimate
        const zoom = fix.acc <= 40 ? 17 : fix.acc <= 200 ? 15.5 : fix.acc <= 1500 ? 13.5 : 12
        mapRef.current?.[first ? 'flyTo' : 'easeTo']({ center: [fix.lng, fix.lat], zoom, duration: first ? 900 : 500 })
        setMapNote(`Improving the fix… within about ${Math.round(fix.acc)} m so far.`)
        if (fix.acc <= 15) finish() // good enough: stop early
      },
      (err) => {
        // a hiccup after a reading has arrived is not a failure: keep what we have and let the timer finish
        if (best && err.code !== 1) return
        if (best) return finish()
        stopWatch()
        setMapNote(
          err.code === 1
            ? 'Location permission was refused. Allow it for this site in the browser, or drag the pin.'
            : err.code === 3
              ? 'Finding your location took too long. Try again outdoors, or drag the pin.'
              : 'Your location is unavailable right now. Check that location is switched on, or drag the pin.',
        )
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
    watch.current = { id, timer: setTimeout(finish, 12000) } // stop refining after 12 s and report what we have
  }

  actions.current = {
    locate,
    toggleStyles: () => setStyleMenu((v) => !v),
  }

  const wsPart = useMemo(() => partAt(pin.lat, pin.lng), [pin])
  // covered = inside the city, or in the part of the Antiao Watershed that lies beyond the city line
  const inCity = Boolean(areaAt(pin.lat, pin.lng))
  const inside = inCity || Boolean(wsPart?.properties.main)
  const at = useMemo(() => (ready && inside ? hazardAt(pin.lat, pin.lng) : null), [ready, inside, pin])
  const barangay = useMemo(() => barangayAt(pin.lat, pin.lng), [pin])
  // the boundary follows the pin: only the part of the watershed it stands in is outlined
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    map.getSource('ws-boundary')?.setData(wsPart || NO_PART)
  }, [wsPart, loaded])
  const nearest = useMemo(
    () =>
      FACILITIES.map((f) => ({ ...f, m: metres(pin, f), hz: ready ? hazardAt(f.lat, f.lng) : null }))
        .sort((a, b) => a.m - b.m)
        .slice(0, 10),
    [pin, ready],
  )

  // The ten facilities nearest the pin also get a raised marker. Ground-level map icons can be hidden behind
  // 3D buildings and terrain; ten markers cost little, whereas one per facility made the map stutter.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    const markers = nearest.map((f) => {
      const k = FACILITY[f.kind]
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'kyh-fac'
      el.style.setProperty('--c', k.color)
      el.setAttribute('aria-label', `${f.name}, ${k.label}`)
      el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${k.glyph}</svg>`
      return new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -6], opacityWhenCovered: '0.95' })
        .setLngLat([f.lng, f.lat])
        .setPopup(new maplibregl.Popup({ offset: 30, closeButton: false, maxWidth: '240px' }).setHTML(`<strong>${esc(f.name)}</strong><br><span>${k.label} · ${distanceText(f.m)} from the pin</span>`))
        .addTo(map)
    })
    return () => markers.forEach((m) => m.remove())
  }, [nearest.map((f) => f.name).join('|'), loaded])

  const facilityFlood = useMemo(() => {
    if (!ready) return null
    const cls = FACILITIES.map((f) => hazardAt(f.lat, f.lng)?.flood || 0)
    return { 3: cls.filter((c) => c === 3).length, 2: cls.filter((c) => c >= 2).length, 1: cls.filter((c) => c >= 1).length }
  }, [ready])
  const [fLow, fMed, fHigh] = WATERSHED_HAZARD.flood
  const pct = (v) => `${+v.toFixed(1)}%`
  const happens = {
    drought: [
      'No flooding, and no rain to trigger landslides.',
      `Streams and springs run low. The ${STREAM_KM} km of mapped waterways are outlined in brown.`,
      'Watch the water supply, and fire in dry grass and forest.',
    ],
    light: ['Drains and streams carry the water away.', 'No flooding is expected, and soaked-slope landslides are unlikely.', 'Good conditions for springs and reservoirs to refill.'],
    heavy: [
      `Water collects first in the lowest ground: about ${pct(fHigh)} of the city (blue).`,
      facilityFlood ? `${facilityFlood[3]} of ${FACILITIES.length} mapped critical facilities sit in those spots.` : '',
      'Slopes in NOAH’s high landslide zone (brown) are the ones to watch.',
    ],
    veryheavy: [
      `Flooding spreads to about ${pct(fHigh + fMed)} of the city; the darkest blue is deepest.`,
      facilityFlood ? `${facilityFlood[2]} of ${FACILITIES.length} mapped critical facilities are in flooded ground.` : '',
      'High landslide-hazard slopes are the most likely to fail; medium ones need watching.',
    ],
    extreme: [
      `About ${pct(fHigh + fMed + fLow)} of the city floods, and ${pct(fHigh)} is under more than 1.5 m of water.`,
      facilityFlood ? `${facilityFlood[1]} of ${FACILITIES.length} mapped critical facilities are in flooded ground.` : '',
      'This step is NOAH’s own 100-year rain flood map: rain with a 1-in-100 chance in any year.',
    ],
  }
  const simLevel = (k) => (at ? SIM_LEVEL[k](weather, at[k]) : null)

  const go = (r) => {
    setQ(r.label)
    setResults(null)
    if (r.lat === undefined) return mapRef.current?.fitBounds([CITY_BOUNDS.slice(0, 2), CITY_BOUNDS.slice(2)], { padding: 30, pitch: 0, bearing: 0, duration: 900 })
    moveTo(r.lat, r.lng)
  }
  const search = (e) => {
    e.preventDefault()
    const found = searchPlaces(q)
    if (found.length === 1 || (found[0] && found[0].label.toLowerCase().replace(/^barangay /, '') === q.trim().toLowerCase())) go(found[0])
    else setResults(found)
  }
  const where = `${inCity ? (barangay ? `Brgy. ${barangay.name}, ${STUDY_AREA}` : STUDY_AREA) : inside ? `${ws.name}, beyond the ${STUDY_AREA} boundary` : `Outside ${STUDY_AREA}`} · ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
  const levelOf = (k) => (at ? LEVEL[at[k]] : null)

  return (
    <section className="kyh" id="hazard-map" data-pressure={pressure ? '' : undefined} aria-label={`Hazard levels in ${STUDY_AREA}`}>
      <div className="kyh-grid">
        <div className="kyh-map">
          <div ref={box} className="kyh-gl" />
          {(!loaded || (!ready && !error)) && (
            <div className="kyh-loading" role="status" aria-live="polite">
              <span className="kyh-drop" aria-hidden="true" />
              <b>{!loaded ? 'Loading the map and terrain…' : 'Loading hazard layers…'}</b>
              <i aria-hidden="true" />
            </div>
          )}
          {weather && !detail && <div className="kyh-weather" data-w={weather} aria-hidden="true" />}
          <div className="kyh-legend">
            <button type="button" className="kyh-legend-toggle" aria-expanded={legend} aria-label={legend ? 'Hide legend' : 'Show legend'} onClick={() => setLegend(!legend)}>
              {legend ? '–' : '+'}
            </button>
            <p>{detail ? `${HAZARD_LAYERS[detail].short} Hazard Level` : weather ? 'Simulation' : 'Hazard Level'}</p>
            {legend &&
              (weather && !detail
                ? (weather === 'drought'
                    ? [['#8a5a2b', 'Waterways running low']]
                    : weather === 'light'
                      ? [['#e2e8f0', 'Nothing to show']]
                      : [
                          [BLUE[0], 'Shallow water'],
                          [BLUE[1], 'Deeper water'],
                          [BLUE[2], 'Deepest water'],
                          [BROWN[0], 'Slope to watch'],
                          [BROWN[1], 'Slope likely to fail'],
                        ]
                  ).map(([c, t]) => (
                    <div key={t}>
                      <i style={{ background: c }} />
                      <span style={{ color: '#334155' }}>{t}</span>
                    </div>
                  ))
                : LEVEL.slice(1).map((l) => (
                    <div key={l.text}>
                      <i style={{ background: l.bar }} />
                      <span style={{ color: l.color }}>{l.text[0] + l.text.slice(1).toLowerCase()}</span>
                    </div>
                  )))}
          </div>
          {!pressure && !detail && !weather && (
            <label className="kyh-hzswitch">
              <input type="checkbox" role="switch" checked={showHz} onChange={(e) => setShowHz(e.target.checked)} />
              <span className="kyh-hzswitch-track" aria-hidden="true" />
              Hazard colours
            </label>
          )}
          {styleMenu && (
            <div className="kyh-styles" role="menu" aria-label="Map style">
              <p>Map style</p>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={mode === m.id}
                  onClick={() => {
                    setMode(m.id)
                    setStyleMenu(false)
                  }}
                >
                  <span aria-hidden="true">{mode === m.id ? '●' : '○'}</span>
                  {m.label}
                  <small>{m.hint}</small>
                </button>
              ))}
            </div>
          )}
          <p className="kyh-mode" aria-live="polite">Map: {MODES.find((m) => m.id === mode).label}</p>
          {mapNote && <p className="kyh-mapnote" role="status">{mapNote}</p>}
        </div>

        <aside className="kyh-panel">
          <div className="kyh-brand">
            <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 2.500C10.500 10 6.500 14.800 6.500 20.300a9.500 9.500 0 0 0 19 0C25.500 14.800 21.500 10 16 2.500z" /></svg>
            <div>
              <strong>Catbalogan Hazard Assessment</strong>
              <span>
                Hazard data from{' '}
                <a href={NOAH.website} target="_blank" rel="noreferrer">
                  Project NOAH
                </a>
                , UP Resilience Institute
              </span>
            </div>
          </div>

          <form className="kyh-search" role="search" onSubmit={search}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.500A2.500 2.500 0 1 1 12 6.500a2.500 2.500 0 0 1 0 5z" fill="#1a73e8" /></svg>
            <input
              type="search"
              value={q}
              aria-label={`Search a location in ${STUDY_AREA}`}
              placeholder="Search Location"
              autoComplete="off"
              onChange={(e) => {
                setQ(e.target.value)
                setResults(e.target.value.trim() ? searchPlaces(e.target.value) : null)
              }}
            />
            <button type="submit" aria-label="Search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.500" cy="10.500" r="6" fill="none" stroke="#fff" strokeWidth="2.600" /><path d="M15 15l5 5" stroke="#fff" strokeWidth="2.600" strokeLinecap="round" /></svg>
            </button>
            {results && (
              <ul className="kyh-results">
                {results.map((r) => (
                  <li key={r.type + r.label + r.sub}>
                    <button type="button" onClick={() => go(r)}>
                      <b>{r.label}</b>
                      <span>{r.sub}</span>
                    </button>
                  </li>
                ))}
                {!results.length && <li className="kyh-empty">No place in {STUDY_AREA} matches “{q.trim()}”.</li>}
              </ul>
            )}
          </form>

          <p className="kyh-tip">
            <b>Tip:</b> You may drag the pin to change the location.
          </p>

          {error && <p className="kyh-alert" role="alert">{error} Check your connection, or use the official Project NOAH map.</p>}
          {!inside && <p className="kyh-alert">The pin is outside {STUDY_AREA} and the {ws.name}, the area covered here. Drag it back, or use the official Project NOAH map for other places.</p>}

          {!detail ? (
            <>
              <h2>{weather ? `What happens: ${WEATHER_BY_ID[weather].title}` : 'Hazard Levels In Your Area'}</h2>
              <p className="kyh-where" aria-live="polite">{where}</p>
              <div className="kyh-cards" aria-live="polite">
                {Object.values(HAZARD_LAYERS).map((l) => {
                  const lv = weather ? simLevel(l.id) : levelOf(l.id)
                  return (
                    <div key={l.id} className="kyh-card" style={{ borderRightColor: lv ? lv.bar : '#cbd5e1' }}>
                      <button type="button" className="kyh-open" onClick={() => setDetail(l.id)} aria-label={`${TITLE[l.id]}: ${lv ? lv.text : 'not available'}. Open details`}>
                        <span className="kyh-icon">{ICON[l.id]}</span>
                        <span>
                          <span className="kyh-card-title">{TITLE[l.id]}</span>
                          <span className="kyh-level" style={{ color: lv ? lv.color : '#94a3b8' }}>
                            {lv ? lv.text : inside && !error ? 'LOADING…' : 'NOT AVAILABLE'}
                          </span>
                        </span>
                      </button>
                      <button type="button" className="kyh-info" aria-expanded={info === l.id} aria-label={`About ${TITLE[l.id]}`} onClick={() => setInfo(info === l.id ? null : l.id)}>
                        i
                      </button>
                      {info === l.id && (
                        <p className="kyh-detail">
                          {l.label}. Modelled for {SCENARIO[l.id]}. Low, medium and high are shown in yellow, orange and red. Click the card to see this hazard on its own.
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {weather && (
                <div className="kyh-sim-box" data-w={weather} aria-live="polite">
                  <h3>Across {STUDY_AREA}</h3>
                  <ul>
                    {happens[weather].filter(Boolean).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <p>
                    {weather === 'extreme'
                      ? 'Storm surge is left out: it comes from a typhoon’s winds, not from rain.'
                      : 'An illustration, not a forecast. NOAH has no flood maps for smaller rain events in Catbalogan, so this step is built from its 100-year flood and landslide maps by rule of thumb. Storm surge is left out: it comes from a typhoon’s winds, not from rain.'}
                  </p>
                </div>
              )}

              <div className="kyh-sim">
                <div className="kyh-sim-head">
                  <b>Weather simulation</b>
                  <button
                    type="button"
                    className="kyh-play"
                    onClick={() => {
                      if (playing) return setPlaying(false)
                      setWeather('drought')
                      setPlaying(true)
                    }}
                  >
                    {playing ? '■ Stop' : '▶ Play'}
                  </button>
                </div>
                <div className="kyh-sim-row" role="group" aria-label="Weather to simulate">
                  {WEATHER.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      data-w={w.id}
                      aria-pressed={weather === w.id}
                      onClick={() => {
                        setPlaying(false)
                        setWeather(weather === w.id ? null : w.id)
                      }}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
                {weather && (
                  <button type="button" className="kyh-sim-off" onClick={() => (setPlaying(false), setWeather(null))}>
                    ← Back to the official hazard maps
                  </button>
                )}
              </div>
              <div className="kyh-ws">

                <div className="kyh-ws-head">
                  <button type="button" className="kyh-fold" aria-expanded={fold.ws} aria-controls="kyh-ws-body" onClick={() => setFold({ ...fold, ws: !fold.ws })}>
                    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {ws.name}
                  </button>
                  <label>
                    <input type="checkbox" checked={showWs} onChange={(e) => setShowWs(e.target.checked)} /> Show on map
                  </label>
                </div>
                {!fold.ws && (
                  <p className="kyh-ws-brief">
                    {wsPart?.properties.main ? `The pin is in part ${wsPart.properties.id} of ${MAIN_PARTS} of this watershed.` : wsPart ? 'The pin is outside this watershed, in another catchment.' : 'The pin is not on mapped land.'}{' '}
                    Open for its size, streams and hazard shares.
                  </p>
                )}
                {fold.ws && (
                  <div id="kyh-ws-body">
                <p>
                  The catchment of the {ws.river}: the land inside the solid dark line, whose rain drains through the blue
                  streams to one outlet. The dashed line marks the smaller catchment where the pin is, inside or outside this
                  watershed, and moves with the pin.
                </p>
                {wsPart ? (
                  <div className="kyh-ws-part">
                    <b>
                      {wsPart.properties.main
                        ? `Pin is in part ${wsPart.properties.id} of ${MAIN_PARTS}: `
                        : `Pin is outside the ${ws.name}, in another catchment: `}
                      {wsPart.properties.barangays.slice(0, 2).map((b) => b.name).join(' and ') || 'outside the city boundary'}
                    </b>
                    <span>
                      {wsPart.properties.km2} km²
                      {wsPart.properties.main ? ` (${Math.round(wsPart.properties.share)}% of the watershed)` : ', draining separately from the Antiao River'} ·{' '}
                      {wsPart.properties.stream_km > 0 ? `${wsPart.properties.stream_km} km of streams · ` : ''}
                      ground from {wsPart.properties.lowest_m} to {wsPart.properties.highest_m} m
                    </span>
                    <span>
                      High landslide hazard on {wsPart.properties.hazard.landslide[2]}% of this {wsPart.properties.main ? 'part' : 'catchment'}, high flood hazard on{' '}
                      {wsPart.properties.hazard.flood[2]}%
                    </span>
                  </div>
                ) : (
                  <div className="kyh-ws-part off">
                    <b>The pin is not on mapped land in {STUDY_AREA}</b>
                    <span>No boundary is drawn. Drag the pin onto land inside the city to outline its catchment.</span>
                  </div>
                )}
                <dl>
                  <div><dt>{ws.area_km2} km²</dt><dd>watershed area</dd></div>
                  <div><dt>{ws.stream_km} km</dt><dd>of streams</dd></div>
                  <div><dt>{ws.highest_m} m</dt><dd>highest ground</dd></div>
                  <div><dt>{ws.barangays.length}</dt><dd>of the city’s {BARANGAYS.length} barangays partly inside</dd></div>
                </dl>
                <h4>How the watershed is distributed</h4>
                <ul className="kyh-ws-bars">
                  {ws.barangays.slice(0, 6).map((b) => (
                    <li key={b.name}>
                      <span>{b.name}</span>
                      <i><em style={{ width: `${Math.max(2, (b.share / ws.barangays[0].share) * 100)}%` }} /></i>
                      <b>{Math.round(b.share)}%</b>
                    </li>
                  ))}
                </ul>
                <p className="kyh-ws-note">
                  Share of the watershed in each barangay
                  {ws.barangays.length > 6 ? `; ${ws.barangays.length - 6} more barangays hold smaller parts` : ''}
                  {ws.outside_city_pct >= 1 ? `. About ${Math.round(ws.outside_city_pct)}% lies beyond the city boundary.` : '.'}
                </p>
                {[
                  ['Landslide hazard', ws.hazard.landslide],
                  ['Flood hazard (100-year)', ws.hazard.flood],
                ].map(([label, v]) => (
                  <div className="kyh-ws-hz" key={label}>
                    <span>{label}</span>
                    <i>{v.map((n, k) => <em key={k} style={{ width: `${n}%`, background: HZ_COLORS[k] }} />)}</i>
                    <small>
                      Low {v[0]}% · Medium {v[1]}% · High {v[2]}% of the watershed
                    </small>
                  </div>
                ))}
                <p className="kyh-ws-key">
                  <span><i className="b" /> {ws.name} boundary</span>
                  <span><i className="d" /> Catchment where the pin is</span>
                  <span><i className="t" /> Streams (from terrain)</span>
                  <span><i className="r" /> Main channel (mapped)</span>
                </p>
                <p className="kyh-fine">
                  Boundaries and streams are worked out from about 30 m elevation data, so they are estimates, not an official
                  DENR or NAMRIA delineation. Small streams may be missing or slightly off.
                </p>
                  </div>
                )}
              </div>
              <div className="kyh-notes">
                <p><b>Note:</b></p>
                <ul>
                  <li>If you want an independent assessment of flood, landslide, or storm surge, then click on the cards above.</li>
                  <li>Assessment is for a point location. Please refer to the map for visual evaluation.</li>
                  <li>These are modelled hazard maps (files dated {NOAH.source_files_dated}) for planning. They are not live forecasts or warnings.</li>
                </ul>
                <h3>Hazards included in map database are:</h3>
                <ol>
                  {INCLUDED.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ol>
                <p>
                  For more information and other places, go to{' '}
                  <a href={NOAH.website} target="_blank" rel="noreferrer">
                    Project NOAH
                  </a>
                  . Data licensed under the Open Database License. Bantay Antiao is not affiliated with or endorsed by Project NOAH.
                </p>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="kyh-back" onClick={() => setDetail(null)}>
                ← All hazard levels
              </button>
              <div className="kyh-tabs" role="tablist" aria-label="Hazard">
                {Object.values(HAZARD_LAYERS).map((l) => (
                  <button key={l.id} type="button" role="tab" aria-selected={detail === l.id} onClick={() => setDetail(l.id)}>
                    <span className="kyh-icon">{ICON[l.id]}</span>
                    {l.short}
                  </button>
                ))}
              </div>
              <h2>{TITLE[detail]} In Your Area</h2>
              <p className="kyh-where" aria-live="polite">{where}</p>
              {(() => {
                const lv = levelOf(detail)
                return (
                  <div className="kyh-big" style={{ borderLeftColor: lv ? lv.bar : '#cbd5e1' }} aria-live="polite">
                    <p className="kyh-level" style={{ color: lv ? lv.color : '#94a3b8' }}>{lv ? lv.text : inside && !error ? 'LOADING…' : 'NOT AVAILABLE'}</p>
                    {at && <p>{MEANING[detail][at[detail]]}</p>}
                  </div>
                )
              })()}

              <h3 className="kyh-sub">Critical facilities near the pin</h3>
              <ul className="kyh-near">
                {nearest.slice(0, 6).map((f) => {
                  const lv = f.hz ? LEVEL[f.hz[detail]] : null
                  return (
                    <li key={f.name}>
                      <button type="button" onClick={() => mapRef.current?.flyTo({ center: [f.lng, f.lat], zoom: 17, duration: 900 })}>
                        <i style={{ background: FACILITY[f.kind].color }} dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" aria-hidden="true">${FACILITY[f.kind].glyph}</svg>` }} />
                        <span>
                          <b>{f.name}</b>
                          <small>
                            {FACILITY[f.kind].label} · {distanceText(f.m)}
                          </small>
                        </span>
                        {lv && <em style={{ color: lv.color }}>{lv.text}</em>}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="kyh-fine">Facilities are from OpenStreetMap and may be incomplete. The level shown is this hazard at each facility’s mapped point.</p>

              <h3 className="kyh-sub">What to do</h3>
              <ul className="kyh-todo">
                {WHAT_TO_DO.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="kyh-fine">
                Modelled for {SCENARIO[detail]} (files dated {NOAH.source_files_dated}). Not a live forecast or warning. Source:{' '}
                <a href={NOAH.website} target="_blank" rel="noreferrer">
                  Project NOAH
                </a>
                .
              </p>
            </>
          )}
        </aside>
      </div>
    </section>
  )
}
