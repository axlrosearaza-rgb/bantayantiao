// A small version of the Explore Map for choosing a place: the same tilted 3D terrain, satellite picture and Project NOAH
// hazard colours, with one pin. Tap the map to drop the pin, or drag it. Styles: pinmap.css.
import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './pinmap.css'
import city from '../data/city.json'
import gis from '../data/gis.json'
import { HAZARD_LAYERS, HAZARD_PIECES, hazardPieces } from '../lib/hazards'
import { DEM_CREDIT, DEM_TILES, FLAT_STYLE, HAZARD_OPACITY, RELIEF, SATELLITE, STYLE_URL, restyle } from '../lib/mapStyle'

// the view opens on the whole mainland of the city
const CITY_BOUNDS = city.polygon.geometry.coordinates[0][0].reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [180, 90, -180, -90])
const RIVER = { type: 'FeatureCollection', features: gis.rivers.features.filter((f) => f.properties.main) }
const TILT = { pitch: 50, bearing: -24 }

/**
 * @param value   {lat, lng} of the pin, or null for no pin yet
 * @param onPick  (lat, lng) => void, called when the map is tapped or the pin is dragged. The parent decides
 *                whether to accept the point; a refused drag puts the pin back.
 * @param target  {lat, lng} to fly to (for example the device's location)
 */
export default function PinMap({ value, onPick, target }) {
  const box = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const latest = useRef({ value, onPick })
  latest.current = { value, onPick }
  const [loaded, setLoaded] = useState(false)
  const [showHz, setShowHz] = useState(false) // hazard colours start off, as on the Explore Map

  useEffect(() => {
    let map
    let cancelled = false
    const start = (style, flat) => {
      if (cancelled) return
      map = new maplibregl.Map({
        container: box.current,
        style,
        bounds: [CITY_BOUNDS.slice(0, 2), CITY_BOUNDS.slice(2)],
        fitBoundsOptions: { padding: 24, ...(flat ? {} : TILT) },
        maxPitch: 62,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        fadeDuration: 0,
        // the map sits inside a long form: the page scrolls normally, Ctrl + scroll or two fingers move the map
        cooperativeGestures: true,
        attributionControl: { compact: true },
      })
      mapRef.current = map
      if (!flat) map.setZoom(map.getZoom() + 0.7) // the tilted fit leaves the city small in the frame
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
      map.on('click', (e) => latest.current.onPick(e.lngLat.lat, e.lngLat.lng))
      map.on('load', () => {
        if (cancelled) return
        const before = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
        // satellite picture of the land, with the hazard colours laid lightly over it
        map.addSource('sat', SATELLITE)
        map.addLayer({ id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-fade-duration': 0 } }, before)
        hazardPieces('all').forEach((url, k) => {
          map.addSource(`hz-${k}`, { type: 'image', url, coordinates: HAZARD_PIECES[k] })
          map.addLayer({ id: `hz-${k}`, type: 'raster', source: `hz-${k}`, layout: { visibility: 'none' }, paint: { 'raster-opacity': HAZARD_OPACITY.satellite, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, before)
        })
        map.addSource('dem', { type: 'raster-dem', tiles: [DEM_TILES], tileSize: 256, maxzoom: 12, encoding: 'terrarium', attribution: DEM_CREDIT })
        if (!flat) map.setTerrain({ source: 'dem', exaggeration: RELIEF })
        map.addSource('main-river', { type: 'geojson', data: RIVER })
        map.addLayer({ id: 'main-river', type: 'line', source: 'main-river', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0b5cd0', 'line-width': 3 } })
        map.addSource('city', { type: 'geojson', data: city.polygon })
        map.addLayer({ id: 'city-line', type: 'line', source: 'city', paint: { 'line-color': '#0f3d3e', 'line-width': 1.8, 'line-dasharray': [3, 3] } })
        setLoaded(true)
      })
    }
    fetch(STYLE_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((style) => start(restyle(style), false))
      .catch(() => start(FLAT_STYLE, true))
    return () => {
      cancelled = true
      markerRef.current = null
      mapRef.current = null
      map?.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    HAZARD_PIECES.forEach((_, k) => map.setLayoutProperty(`hz-${k}`, 'visibility', showHz ? 'visible' : 'none'))
  }, [showHz, loaded])

  // the pin follows the chosen point
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    if (!value) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    if (!markerRef.current) {
      const marker = new maplibregl.Marker({ draggable: true, color: '#0f5e63', scale: 1.1, opacityWhenCovered: '1' })
      marker.on('dragend', () => {
        const p = marker.getLngLat()
        latest.current.onPick(p.lat, p.lng)
        // if the parent refused the point (outside the city), the pin goes back to where it was
        setTimeout(() => latest.current.value && markerRef.current?.setLngLat([latest.current.value.lng, latest.current.value.lat]), 0)
      })
      markerRef.current = marker.setLngLat([value.lng, value.lat]).addTo(map)
    } else markerRef.current.setLngLat([value.lng, value.lat])
  }, [value, loaded])

  useEffect(() => {
    if (target && loaded) mapRef.current?.flyTo({ center: [target.lng, target.lat], zoom: 15.5, duration: 900 })
  }, [target, loaded])

  return (
    <div className="pinmap">
      <div ref={box} className="pinmap-gl" />
      {!loaded && <div className="pinmap-loading">Loading the map…</div>}
      <div className="pinmap-legend">
        <label>
          <input type="checkbox" checked={showHz} onChange={(e) => setShowHz(e.target.checked)} /> Hazard colours
        </label>
        {showHz && HAZARD_LAYERS.flood.classes.map((c) => (
          <span key={c.cls}>
            <i style={{ background: c.css }} />
            {['Low', 'Medium', 'High'][c.cls - 1]}
          </span>
        ))}
      </div>
    </div>
  )
}
