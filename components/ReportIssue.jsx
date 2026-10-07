// Public "Report an issue" form on the home page: no account needed.
// One page, top to bottom: what, where, photo, note, who is reporting. The report goes to the official of the
// barangay the resident chooses (the pin only suggests one). Styles: .rep in pages/home.css.
import { useEffect, useState } from 'react'
import { CATEGORIES, CATEGORY } from '../lib/constants'
import { areaAt } from '../lib/geo'
import { BARANGAY, BARANGAYS, STUDY_AREA, barangayAt, barangayPoint } from '../lib/hazards'
import { shrinkPhoto } from '../lib/photo'
import { BACKEND, findReport, submitReport } from '../lib/store'
import PinMap from './PinMap'

const HINT = {
  illegal_clearing: 'Trees being cut or burned',
  turbid_water: 'Muddy, dirty or smelly water',
  waste_dumping: 'Garbage or waste',
  flooding: 'Flooded area',
  erosion: 'Soil washing away',
  landslide: 'Slope that slid or cracked',
  drying_spring: 'Water source drying up or damaged',
  river_obstruction: 'River or creek blocked',
  other: 'Something else',
}
const EMPTY = { category: null, loc: null, barangayId: '', suggested: null, place: '', photo: null, note: '', name: '', contact: '', share: true, urgent: false }

export default function ReportIssue() {
  const [d, setD] = useState(EMPTY)
  const set = (patch) => setD((cur) => ({ ...cur, ...patch }))
  const [locMsg, setLocMsg] = useState('')
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [ref, setRef] = useState('')
  const barangay = BARANGAY[d.barangayId]

  const pick = (lat, lng, how) => {
    if (!areaAt(lat, lng)) {
      setLocMsg(how === 'gps' ? `Your location is outside ${STUDY_AREA}. Tap the map where the problem is.` : `That point is outside ${STUDY_AREA}. Tap inside the dashed line.`)
      return
    }
    // The pin only SUGGESTS a barangay; the resident's own choice decides where the report goes.
    const guess = barangayAt(lat, lng)
    setD((cur) => ({ ...cur, loc: { lat, lng }, suggested: guess?.id || null, barangayId: cur.barangayId || guess?.id || '' }))
    setLocMsg('')
    if (how === 'gps') setTarget({ lat, lng })
  }
  // Choosing a barangay puts the pin in it and shows it on the map, unless a pin is already inside that barangay.
  const chooseBarangay = (id) => {
    const point = id && d.suggested !== id ? barangayPoint(id) : null
    if (!point) return set({ barangayId: id })
    set({ barangayId: id, loc: point, suggested: id })
    setLocMsg('')
    setTarget({ ...point })
  }
  const useGps = () => {
    if (!('geolocation' in navigator)) return setLocMsg('This device cannot share its location. Tap the map instead.')
    if (!window.isSecureContext) return setLocMsg('Location only works on a secure (https) address. Tap the map instead.')
    setLocMsg('Finding your location…')
    navigator.geolocation.getCurrentPosition(
      (p) => pick(p.coords.latitude, p.coords.longitude, 'gps'),
      (e) => setLocMsg(e.code === 1 ? 'Location permission was refused. Tap the map instead.' : 'Could not get your location. Tap the map instead.'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
  }

  const missing = !d.category ? 'Choose what you saw.' : !d.loc ? 'Tap the map to mark where it is.' : !barangay ? 'Choose the barangay.' : !d.name.trim() ? 'Enter your name.' : ''
  const submit = async (e) => {
    e.preventDefault()
    if (missing) return setError(missing)
    setBusy(true)
    setError('')
    try {
      const row = await submitReport({
        title: CATEGORY[d.category].label,
        category: d.category,
        latitude: d.loc.lat,
        longitude: d.loc.lng,
        description: d.note,
        photo: d.photo,
        user: { id: `guest:${Date.now().toString(36)}`, name: d.name.trim() },
        barangay,
        placeNote: d.place,
        severity: 'Moderate',
        urgent: d.urgent,
        contact: d.contact,
        contactShared: d.share,
      })
      setDone(row)
    } catch (err) {
      setError(`The report was not sent: ${err.message} Please try again.`)
    }
    setBusy(false)
  }

  // status lookup by reference number, a moment after typing stops
  const [found, setFound] = useState(null)
  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => findReport(ref).then((r) => alive && setFound(r)).catch(() => alive && setFound(null)), 300)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [ref, done])

  return (
    <section className="rep alt" id="report">
      <div className="wrap rep-wrap">
        <p className="eyebrow">Community reporting</p>
        <h2>Report an issue</h2>
        <p className="lede">
          Saw something that threatens the water or the land in {STUDY_AREA}? Tell your barangay in under a minute. No account
          needed.
        </p>

        {done ? (
          <div className="rep-card rep-done" role="status">
            <span className="rep-tick" aria-hidden="true">✓</span>
            <h3>Report sent</h3>
            <p className="rep-ref">
              Reference <b>{done.id}</b>
            </p>
            <p>
              It went to the barangay official of <b>{done.barangay_name}</b>, who reviews it first and can forward it to the
              MENRO, MDRRMO or another office. Keep the reference to check its progress below.
            </p>
            {done.urgent && <p className="rep-urgent">If anyone is in immediate danger, call 911 or your local disaster office now.</p>}
            <button type="button" className="btn btn-primary" onClick={() => (setDone(null), setD(EMPTY))}>
              Send another report
            </button>
          </div>
        ) : (
          <form className="rep-card" onSubmit={submit} noValidate>
            <fieldset>
              <legend>1. What did you see?</legend>
              <div className="rep-cats">
                {CATEGORIES.map((c) => (
                  <label key={c.id} className={d.category === c.id ? 'on' : ''}>
                    <input type="radio" name="category" checked={d.category === c.id} onChange={() => set({ category: c.id })} />
                    <span className="rep-emoji" aria-hidden="true">{c.icon}</span>
                    <b>{c.label}</b>
                    <small>{HINT[c.id]}</small>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>2. Where?</legend>
              <div className="rep-where">
                <span>Tap the map to drop a pin, then drag it to adjust</span>
                <button type="button" className="rep-gps" onClick={useGps}>
                  Use my location
                </button>
              </div>
              <div className="rep-map">
                <PinMap value={d.loc} onPick={pick} target={target} />
              </div>
              <p className={`rep-msg${locMsg ? ' warn' : ''}`} role="status">
                {locMsg || (d.loc ? `Pin placed at ${d.loc.lat.toFixed(5)}, ${d.loc.lng.toFixed(5)}. Drag it to the exact spot.` : 'No pin yet. Tap the map, or choose the barangay below.')}
              </p>
              <div className="rep-two">
                <label className="rep-field">
                  Barangay
                  <select value={d.barangayId} onChange={(e) => chooseBarangay(e.target.value)}>
                    <option value="">Choose the barangay…</option>
                    {BARANGAYS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    {d.suggested && d.suggested !== d.barangayId && d.barangayId
                      ? `The pin looks like Brgy. ${BARANGAY[d.suggested].name}, but your choice is used.`
                      : 'Your report goes to this barangay’s official. Check it is right.'}
                  </small>
                </label>
                <label className="rep-field">
                  <span>Sitio or landmark <i>(optional)</i></span>
                  <input value={d.place} maxLength={120} onChange={(e) => set({ place: e.target.value })} placeholder="e.g. behind the elementary school" />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>
                3. Add a photo <i>(optional)</i>
              </legend>
              <label className="rep-photo">
                <span aria-hidden="true">📷</span> {d.photo ? 'Change photo' : 'Tap to take or choose a photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      set({ photo: await shrinkPhoto(f) })
                      setError('')
                    } catch (err) {
                      setError(err.message)
                    }
                  }}
                />
              </label>
              {d.photo && (
                <div className="rep-preview">
                  <img src={d.photo} alt="Photo attached to the report" />
                  <button type="button" onClick={() => set({ photo: null })}>
                    Remove photo
                  </button>
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend>
                4. Short note <i>(optional)</i>
              </legend>
              <textarea rows={3} maxLength={600} value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder="Anything else we should know?" aria-label="Short note" />
            </fieldset>

            <fieldset>
              <legend>5. About you</legend>
              <div className="rep-two">
                <label className="rep-field">
                  Your name
                  <input value={d.name} maxLength={80} autoComplete="name" onChange={(e) => set({ name: e.target.value })} />
                </label>
                <label className="rep-field">
                  <span>Mobile number or email <i>(optional)</i></span>
                  <input value={d.contact} maxLength={80} autoComplete="tel" onChange={(e) => set({ contact: e.target.value })} placeholder="So the barangay can ask for details" />
                </label>
              </div>
              <label className="rep-check">
                <input type="checkbox" checked={d.share} disabled={!d.contact.trim()} onChange={(e) => set({ share: e.target.checked })} />
                <span>Let the barangay official and the responsible office see my contact details. They are never shown to other residents or on the public map.</span>
              </label>
              <label className={`rep-check${d.urgent ? ' urgent' : ''}`}>
                <input type="checkbox" checked={d.urgent} onChange={(e) => set({ urgent: e.target.checked })} />
                <span>
                  <b>Someone’s life or safety is at risk right now.</b> The report is flagged urgent and also shown to the disaster office.
                </span>
              </label>
              {d.urgent && (
                <p className="rep-urgent" role="alert">
                  If anyone is in immediate danger, call 911 or your local disaster office now. This platform does not replace official emergency hotlines.
                </p>
              )}
            </fieldset>

            {error && (
              <p className="rep-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary rep-send" disabled={busy}>
              {busy ? 'Sending…' : 'Send report'}
            </button>
            <p className="rep-fine">A report is a community observation. It counts as evidence only after the barangay official verifies it.</p>
          </form>
        )}

        <div className="rep-track">
          <label className="rep-field">
            Already sent a report? Check its status
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Reference, e.g. BU-2026-00241" />
          </label>
          {ref.trim() && (
            <p role="status">
              {found ? (
                <>
                  <b>{found.id}</b> · {CATEGORY[found.category].label} · Brgy. {found.barangay_name} · <b>{found.status}</b>
                </>
              ) : BACKEND === 'local' ? (
                'No report with that reference was found on this device.'
              ) : (
                'No report with that reference was found.'
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
