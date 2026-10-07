// Search bar, hazard read-out and the state behind them. Used by the public hazard map and the dashboard.
import { useEffect, useId, useRef, useState } from 'react'
import L from 'leaflet'
import { AREA, areaAt } from '../lib/geo'
import {
  BARANGAY,
  BARANGAYS,
  CLASS_NAME,
  HAZARD_LAYERS,
  NOAH,
  STUDY_AREA,
  WATERSHED_HAZARD,
  barangayAt,
  hazardAt,
  loadHazards,
  searchPlaces,
  unitHazard,
} from '../lib/hazards'
import { WATERSHED_BOUNDS } from './MapView'

const boundsOf = (geometries) => L.featureGroup(geometries.map((g) => L.geoJSON(g))).getBounds()

/** Selected place + where the map should fly. `onArea` is told which management unit a point falls in. */
export function useExplorer(onArea) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [place, setPlace] = useState(null)
  const [view, setView] = useState(null)
  useEffect(() => {
    let alive = true
    loadHazards()
      .then(() => alive && setReady(true))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [])

  const pick = (lat, lng, label) => {
    const b = barangayAt(lat, lng)
    const areaId = areaAt(lat, lng)
    setPlace({ type: 'point', lat, lng, label: label || (b ? `Brgy. ${b.name}, ${b.municipality}` : 'Selected point'), barangayId: b?.id || null, areaId })
    if (areaId) onArea?.(areaId)
  }
  const choose = (r) => {
    if (r.type === 'watershed') {
      setPlace({ type: 'watershed', label: r.label })
      setView({ bounds: WATERSHED_BOUNDS })
    } else if (r.type === 'municipality') {
      setPlace({ type: 'municipality', label: r.label, municipality: r.municipality })
      setView({ bounds: boundsOf(BARANGAYS.filter((b) => b.municipality === r.municipality).map((b) => b.geometry)) })
    } else if (r.type === 'barangay') {
      const b = BARANGAY[r.barangay]
      const areaId = areaAt(r.lat, r.lng)
      setPlace({ type: 'barangay', label: r.label, lat: r.lat, lng: r.lng, barangayId: b.id, areaId })
      setView({ bounds: boundsOf([b.geometry]) })
      if (areaId) onArea?.(areaId)
    } else {
      pick(r.lat, r.lng, r.label)
      setView({ lat: r.lat, lng: r.lng, zoom: r.type === 'unit' ? 12 : 14 })
    }
  }
  return { ready, error, place, view, pick, choose, clear: () => setPlace(null) }
}

export function SearchBar({ onChoose, large = false }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const id = useId()
  const box = useRef(null)
  const results = searchPlaces(q)
  useEffect(() => {
    const close = (e) => !box.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const go = (r) => {
    setQ(r.label)
    setOpen(false)
    onChoose(r)
  }
  return (
    <div ref={box} className="relative" role="search">
      <label htmlFor={id} className="sr-only">
        Search a barangay or place in Catbalogan City
      </label>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">
        🔎
      </span>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        value={q}
        placeholder="Search a barangay, river or place in Catbalogan…"
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(results.length - 1, a + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (e.key === 'Enter' && results[active]) {
            e.preventDefault()
            go(results[active])
          } else if (e.key === 'Escape') setOpen(false)
        }}
        className={`w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 ${
          large ? 'py-3 text-base' : 'py-2 text-sm'
        }`}
      />
      {open && q.trim() && (
        <ul id={`${id}-list`} role="listbox" className="absolute left-0 right-0 top-full z-[1200] mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {results.map((r, i) => (
            <li key={r.type + r.label + r.sub} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left ${i === active ? 'bg-brand-50' : ''}`}
              >
                <span className="text-sm font-semibold text-slate-900">{r.label}</span>
                <span className="truncate text-xs text-slate-500">{r.sub}</span>
              </button>
            </li>
          ))}
          {!results.length && <li className="px-3 py-2 text-sm text-slate-500">No place in Catbalogan City matches “{q.trim()}”.</li>}
        </ul>
      )}
    </div>
  )
}

export function Shares({ kind, shares }) {
  const l = HAZARD_LAYERS[kind]
  const total = shares.reduce((a, b) => a + b, 0)
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="font-medium text-slate-700">{l.label}</span>
        <span className="tabular-nums text-slate-500">{total.toFixed(1)}% of area mapped</span>
      </div>
      <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${l.label}: low ${shares[0]}%, medium ${shares[1]}%, high ${shares[2]}%`}>
        {shares.map((s, i) => (
          <span key={i} style={{ width: `${s}%`, background: l.classes[i].css }} />
        ))}
      </div>
      <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
        Low {shares[0]}% · Medium {shares[1]}% · High {shares[2]}%
      </p>
    </div>
  )
}

function municipalityShares(name) {
  const list = BARANGAYS.filter((b) => b.municipality === name)
  const cells = list.reduce((a, b) => a + b.hazard.cells, 0)
  const mix = (k) => [0, 1, 2].map((i) => +(list.reduce((a, b) => a + b.hazard[k][i] * b.hazard.cells, 0) / cells).toFixed(1))
  return { ...Object.fromEntries(Object.keys(HAZARD_LAYERS).map((k) => [k, mix(k)])), count: list.length }
}

/** Official hazard information for the selected place. Always rendered before any prototype analytics. */
export function HazardInfo({ place, ready, error }) {
  const at = place?.lat !== undefined && ready ? hazardAt(place.lat, place.lng) : null
  const inWatershed = place?.type !== 'point' && place?.type !== 'barangay' ? true : Boolean(place.areaId)
  const b = place?.barangayId ? BARANGAY[place.barangayId] : null
  const muni = place?.type === 'municipality' ? municipalityShares(place.municipality) : null
  const unit = place?.areaId && !b ? unitHazard(place.areaId) : null

  return (
    <section aria-labelledby="hz-title" className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <span className="rounded bg-brand-900 px-1.5 py-0.5 text-[10px] text-white">Official data</span>
        Project NOAH hazard information
      </p>
      <h2 id="hz-title" className="mt-1 text-lg font-bold leading-tight text-slate-900">
        {place ? place.label : STUDY_AREA}
      </h2>

      {error && (
        <p role="alert" className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-800">
          {error} Check your connection, or open the official NOAH map below.
        </p>
      )}
      {!place && <p className="mt-1 text-sm text-slate-600">Search a place or click the map to read the mapped hazard at that spot.</p>}

      {place?.lat !== undefined && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            At this point · {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
          </p>
          {!inWatershed || (ready && !at) ? (
            <p className="mt-1 rounded-md bg-slate-50 p-2 text-sm text-slate-600">
              This point is outside Catbalogan City, the area processed here. Use the official NOAH map for this location.
            </p>
          ) : !ready && !error ? (
            <p className="mt-1 text-sm text-slate-500">Loading hazard layers…</p>
          ) : at ? (
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {Object.values(HAZARD_LAYERS).map((l) => {
                const cls = at[l.id]
                const c = l.classes[cls - 1]
                return (
                  <div key={l.id} className="rounded-lg border border-slate-200 p-2">
                    <p className="text-[11px] font-semibold text-slate-500">{l.short}</p>
                    <p className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                      <span className="h-3 w-3 rounded-sm border border-slate-300" style={{ background: c ? c.css : '#fff' }} />
                      {CLASS_NAME[cls]}
                    </p>
                    <p className="text-[11px] leading-snug text-slate-500">{c ? c.note : 'No hazard mapped at this spot.'}</p>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-3 space-y-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {b
            ? `Barangay ${b.name}, ${b.municipality}`
            : muni
              ? `${place.municipality}: ${muni.count} barangays`
              : unit
                ? AREA[place.areaId].name
                : `All of ${STUDY_AREA}`}
        </p>
        {(() => {
          const s = b ? b.hazard : muni || unit || WATERSHED_HAZARD
          return (
            <>
              {Object.keys(HAZARD_LAYERS).map((k) => (
                <Shares key={k} kind={k} shares={s[k]} />
              ))}
            </>
          )
        })()}
      </div>

      <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-snug text-slate-500">
        Source: {NOAH.publisher}. Files dated {NOAH.source_files_dated}; {NOAH.license}. These are modelled hazard maps for
        planning. They are <b>not</b> live forecasts or warnings.{' '}
        <a href={NOAH.website} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 underline">
          Open the official Project NOAH map
        </a>
      </p>
    </section>
  )
}
