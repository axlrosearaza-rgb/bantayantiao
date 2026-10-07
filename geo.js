import gis from '../data/gis.json'

export const AREAS = gis.areas.features.map((f) => f.properties)
export const AREA = Object.fromEntries(AREAS.map((a) => [a.id, a]))

function inRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Barangay (management unit) containing a point, or null when outside the study area. */
export function areaAt(lat, lng) {
  const f = gis.areas.features.find((f) =>
    (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).some(
      (p) => inRing(lng, lat, p[0]) && !p.slice(1).some((hole) => inRing(lng, lat, hole)),
    ),
  )
  return f ? f.properties.id : null
}

export function distanceKm(a, b) {
  const R = 6371
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
