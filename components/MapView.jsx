import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { CircleMarker, GeoJSON, ImageOverlay, MapContainer, Marker, Pane, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import gis from '../data/gis.json'
import { CATEGORY, LEVELS, STATUS_STYLE, isEvidence } from '../lib/constants'
import { AREA, timeAgo } from '../lib/geo'
import { BARANGAYS, HAZARD_BOUNDS, HAZARD_LAYERS, NOAH } from '../lib/hazards'
import Basemap, { MapboxMark } from './Basemap'
import { StatusChip } from './ui'

export const WATERSHED_BOUNDS = L.geoJSON(gis.boundary).getBounds()
const BARANGAY_FC = {
  type: 'FeatureCollection',
  features: BARANGAYS.map((b) => ({ type: 'Feature', properties: { id: b.id, name: b.name, municipality: b.municipality }, geometry: b.geometry })),
}
const PIN = L.divIcon({ className: '', html: '<div class="bu-drop">📍</div>', iconSize: [30, 30], iconAnchor: [15, 28] })

export function reportIcon(r, fresh = false) {
  const s = STATUS_STYLE[r.status] || STATUS_STYLE.Submitted
  const muted = r.status === 'Closed' || r.status === 'Resolved'
  const badge = r.urgent && !muted ? '!' : isEvidence(r) ? '✓' : r.status === 'Resolved' ? '✓' : r.status === 'Closed' ? '✕' : ''
  return L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    html: `<div class="bu-pin${muted ? ' is-muted' : ''}${fresh ? ' is-new' : ''}" style="--c:${r.urgent && !muted ? '#dc2626' : s.color};--ring:${s.ring}">${CATEGORY[r.category].icon}${
      badge ? `<span class="bu-badge">${badge}</span>` : ''
    }</div>`,
  })
}

function Controller({ focus, markers, view, onPoint }) {
  const map = useMap()
  useMapEvents({ click: (e) => onPoint?.(e.latlng.lat, e.latlng.lng) })
  useEffect(() => {
    // refit once the panel has its real size, then just keep Leaflet in sync with layout changes
    let fitted = false
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
      if (!fitted && map.getSize().y > 100) {
        fitted = true
        map.fitBounds(WATERSHED_BOUNDS, { padding: [10, 10], animate: false })
      }
    })
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  useEffect(() => {
    if (!focus) return
    map.flyTo([focus.latitude, focus.longitude], Math.max(map.getZoom(), 13), { duration: 0.8 })
    const t = setTimeout(() => markers.current[focus.id]?.openPopup(), 900)
    return () => clearTimeout(t)
  }, [focus, map, markers])
  // search results: fly to a point, or fit a boundary
  useEffect(() => {
    if (!view) return
    if (view.bounds) map.flyToBounds(view.bounds, { padding: [30, 30], duration: 0.8, maxZoom: 14 })
    else map.flyTo([view.lat, view.lng], view.zoom || 14, { duration: 0.8 })
  }, [view, map])
  return null
}

function Legend({ layers }) {
  const hazards = Object.values(HAZARD_LAYERS).filter((l) => layers[l.id])
  if (!layers.areas && !hazards.length) return null
  return (
    <div className="absolute bottom-3 left-3 z-[500] max-h-[70%] max-w-[190px] overflow-y-auto rounded-lg bg-white/95 p-2.5 text-[11px] shadow-md">
      {hazards.map((l) => (
        <div key={l.id} className="mb-2">
          <p className="mb-1 font-bold leading-tight text-slate-700">{l.label}</p>
          {l.classes.map((c) => (
            <div key={c.cls} className="flex items-center gap-1.5">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: c.css }} />
              <span>{c.name}</span>
            </div>
          ))}
        </div>
      ))}
      {hazards.length > 0 && <p className="mb-2 leading-tight text-slate-500">Official hazard data: Project NOAH (2021). Not a live forecast.</p>}
      {layers.areas && (
        <>
          <p className="mb-1 font-bold text-slate-700">Watershed Pressure Index</p>
          {Object.entries(LEVELS).map(([name, l], i) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border border-white" style={{ background: l.color }} />
              <span>
                {name} <span className="text-slate-400">{['0–24', '25–49', '50–74', '75–100'][i]}</span>
              </span>
            </div>
          ))}
          <p className="mt-1 leading-tight text-slate-500">Prototype indicator, not official hazard data.</p>
        </>
      )}
      {layers.reports && (
        <p className="mt-1.5 border-t border-slate-200 pt-1.5 leading-tight text-slate-500">
          Round pins are community reports: <span className="font-semibold">dashed</span> = not yet verified,{' '}
          <span className="font-semibold text-green-700">solid ✓</span> = verified by the barangay.
        </p>
      )}
    </div>
  )
}

/**
 * layers: { areas, forest, rivers, farms, settlements, terrain, reports, flood, landslide, barangays }
 * onPoint(lat, lng): any map click. pin: { lat, lng }. highlightId: barangay to outline. view: where to fly.
 */
export default function MapView({ layers, assessments, selectedId, onSelect, reports, focus, onOpenReport, freshIds, onPoint, pin, highlightId, view }) {
  const markers = useRef({})
  const live = useRef({})
  live.current = { assessments, onSelect }
  const hazardOn = layers.flood || layers.landslide
  const dimAreas = hazardOn || layers.forest || layers.farms

  const areaStyle = (f) => {
    const a = assessments[f.properties.id]
    const sel = f.properties.id === selectedId
    return {
      color: sel ? '#0f172a' : hazardOn ? LEVELS[a.level].color : '#ffffff',
      weight: sel ? 3 : hazardOn ? 2 : 1.2,
      fillColor: LEVELS[a.level].color,
      // with official hazard layers on, units are drawn as outlines so the two are never confused
      fillOpacity: hazardOn ? 0.04 : dimAreas ? 0.12 : sel ? 0.72 : 0.58,
    }
  }
  const eachArea = useMemo(
    () => (f, layer) => {
      layer.bindTooltip(
        () => {
          const a = live.current.assessments[f.properties.id]
          return `${f.properties.name} · WPI ${a.wpi} (${a.level})`
        },
        { sticky: true, className: 'bu-tip' },
      )
      layer.on('click', () => live.current.onSelect?.(f.properties.id))
    },
    [],
  )

  return (
    <div className="relative h-full w-full">
      <MapContainer bounds={WATERSHED_BOUNDS} boundsOptions={{ padding: [10, 10] }} className="h-full w-full" zoomSnap={0.25} scrollWheelZoom>
        <Basemap />
        {layers.terrain && (
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxNativeZoom={15}
            opacity={0.9}
            attribution='Terrain: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), SRTM'
          />
        )}
        <Controller focus={focus} markers={markers} view={view} onPoint={onPoint} />

        <Pane name="hazards" style={{ zIndex: 405 }}>
          {Object.values(HAZARD_LAYERS).map(
            (l) =>
              layers[l.id] && (
                <ImageOverlay
                  key={l.id}
                  url={l.url}
                  bounds={HAZARD_BOUNDS}
                  opacity={0.7}
                  className="bu-hazard"
                  attribution={`Hazard maps: &copy; <a href="${NOAH.website}" target="_blank" rel="noreferrer">Project NOAH</a>, UP Resilience Institute (ODbL)`}
                />
              ),
          )}
        </Pane>
        <Pane name="areas" style={{ zIndex: 410 }}>
          {layers.areas && <GeoJSON data={gis.areas} style={areaStyle} onEachFeature={eachArea} />}
        </Pane>
        <Pane name="landcover" style={{ zIndex: 420 }}>
          {layers.forest && (
            <GeoJSON
              data={gis.areas}
              interactive={false}
              style={(f) => ({ stroke: false, fillColor: '#166534', fillOpacity: (f.properties.forest_pct / 100) * 0.75 })}
            />
          )}
          {layers.farms && (
            <GeoJSON
              data={gis.areas}
              interactive={false}
              style={(f) => ({ stroke: false, fillColor: '#ca8a04', fillOpacity: (f.properties.farmland_pct / 100) * 0.9 })}
            />
          )}
        </Pane>
        <Pane name="outline" style={{ zIndex: 425 }}>
          {layers.barangays && (
            <GeoJSON
              data={BARANGAY_FC}
              interactive={false}
              style={(f) =>
                f.properties.id === highlightId
                  ? { color: '#0f172a', weight: 3, fill: false }
                  : { color: '#475569', weight: 0.8, dashArray: '3 3', fill: false }
              }
            />
          )}
          {!layers.barangays && highlightId && (
            <GeoJSON
              key={highlightId}
              data={BARANGAY_FC.features.find((f) => f.properties.id === highlightId)}
              interactive={false}
              style={{ color: '#0f172a', weight: 3, fill: false }}
            />
          )}
          <GeoJSON data={gis.boundary} interactive={false} style={{ color: '#0f3d3e', weight: 2.5, dashArray: '6 5', fill: false }} />
        </Pane>
        <Pane name="rivers" style={{ zIndex: 430 }}>
          {layers.rivers && (
            <GeoJSON
              data={gis.rivers}
              interactive={false}
              style={(f) =>
                f.properties.main
                  ? { color: '#0b5cad', weight: 3.5, opacity: 0.95 }
                  : { color: '#2b7fd0', weight: f.properties.kind === 'river' ? 1.8 : 1, opacity: 0.85 }
              }
            />
          )}
        </Pane>
        <Pane name="settlements" style={{ zIndex: 440 }}>
          {layers.settlements &&
            gis.settlements.map((s) => (
              <CircleMarker
                key={s.name + s.lat}
                center={[s.lat, s.lng]}
                radius={s.place === 'town' ? 7 : s.place === 'village' ? 5 : 3.5}
                pathOptions={{ color: '#fff', weight: 1.5, fillColor: '#7c3aed', fillOpacity: 0.9 }}
              >
                <Tooltip className="bu-tip">
                  {s.name} <span className="font-normal text-slate-500">({s.place})</span>
                </Tooltip>
              </CircleMarker>
            ))}
        </Pane>

        {pin && <Marker position={[pin.lat, pin.lng]} icon={PIN} interactive={false} zIndexOffset={1000} />}

        {layers.reports &&
          reports.map((r) => (
            <Marker
              key={`${r.id}-${r.status}`}
              position={[r.latitude, r.longitude]}
              icon={reportIcon(r, freshIds?.has(r.id))}
              ref={(m) => {
                if (m) markers.current[r.id] = m
              }}
            >
              <Popup>
                <div className="space-y-1.5 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <b>
                      {CATEGORY[r.category].icon} {r.title || CATEGORY[r.category].label}
                    </b>
                  </div>
                  <StatusChip status={r.status} />
                  {r.urgent && <p className="!m-0 text-xs font-bold text-red-700">Flagged urgent by the reporter</p>}
                  {r.photo_url && <img src={r.photo_url} alt="Submitted evidence" className="max-h-32 w-full rounded-md object-cover" />}
                  {r.description && <p className="!m-0 text-slate-700">{r.description}</p>}
                  <p className="!m-0 text-xs text-slate-500">
                    {CATEGORY[r.category].label}
                    <br />
                    {r.barangay_name ? `Brgy. ${r.barangay_name}, ${r.municipality}` : AREA[r.area_id]?.name || 'Location not set'}
                    <br />
                    {timeAgo(r.created_at)} · {r.id}
                  </p>
                  <p className="!m-0 text-[11px] italic text-slate-500">
                    {isEvidence(r) ? 'Community report verified by the barangay. Not official hazard data.' : 'Community report. Not official hazard data.'}
                  </p>
                  {!r.public_only && onOpenReport && (
                    <button
                      onClick={() => onOpenReport(r)}
                      className="w-full rounded-md bg-brand-500 px-2 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
                    >
                      Open report
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
      <MapboxMark />
      <Legend layers={layers} />
    </div>
  )
}
