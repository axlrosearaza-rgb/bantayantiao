import { useState } from 'react'
import PinMap from '../components/PinMap'
import { EMERGENCY_NOTE } from '../components/ReportDetail'
import { CATEGORIES, CATEGORY, SEVERITIES } from '../lib/constants'
import { areaAt } from '../lib/geo'
import { BARANGAY, BARANGAYS, MUNICIPALITIES, barangayAt, barangayPoint } from '../lib/hazards'
import { submitReport } from '../lib/store'

const BIG = 'w-full rounded-2xl px-4 py-4 text-left text-lg font-semibold shadow-sm active:scale-[0.99]'
const INPUT = 'mt-1 w-full rounded-2xl border border-slate-300 p-3 text-base font-normal'
const LABEL = 'mt-4 block text-sm font-semibold text-slate-700'

/** Downscale a photo in the browser so uploads stay small on mobile data. */
function shrink(file, max = 1000) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = URL.createObjectURL(file)
  })
}

const EMPTY = { category: null, loc: null, barangayId: '', suggested: null, placeNote: '', title: '', notes: '', photo: null, severity: 'Moderate', urgent: false, contact: '', contactShared: false }

export default function ReportWizard({ role }) {
  const [step, setStep] = useState(1)
  const [d, setD] = useState(EMPTY)
  const set = (patch) => setD((cur) => ({ ...cur, ...patch }))
  const [locMsg, setLocMsg] = useState('')
  const [target, setTarget] = useState(null) // where the map should fly to (the device's location)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')
  const barangay = BARANGAY[d.barangayId]

  const pick = (lat, lng, source) => {
    if (!areaAt(lat, lng)) {
      setLocMsg(
        source === 'gps'
          ? 'Your current location is outside Catbalogan City. Tap the map to pin where the problem is.'
          : 'That point is outside Catbalogan City. Please tap inside the dashed line.',
      )
      return
    }
    // The pin only SUGGESTS a barangay. The resident confirms or changes it below; routing never relies on GPS alone.
    const guess = barangayAt(lat, lng)
    set({ loc: { lat, lng }, suggested: guess?.id || null, ...(d.barangayId ? {} : { barangayId: guess?.id || '' }) })
    setLocMsg('')
    if (source === 'gps') setTarget({ lat, lng })
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
    if (!navigator.geolocation) return setLocMsg('This device does not provide location. Tap the map instead.')
    setLocMsg('Getting your location…')
    navigator.geolocation.getCurrentPosition(
      (p) => pick(p.coords.latitude, p.coords.longitude, 'gps'),
      () => setLocMsg('Could not get your location. Tap the map to pin it instead.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      setDone(
        await submitReport({
          title: d.title,
          category: d.category,
          latitude: d.loc.lat,
          longitude: d.loc.lng,
          description: d.notes,
          photo: d.photo,
          user: role.user,
          barangay,
          placeNote: d.placeNote,
          severity: d.severity,
          urgent: d.urgent,
          contact: d.contact,
          contactShared: d.contactShared,
        }),
      )
    } catch (e) {
      setError(`Report was not sent: ${e.message} Please try again.`)
    }
    setBusy(false)
  }
  const restart = () => {
    setStep(1)
    setD(EMPTY)
    setDone(null)
  }
  const canNext = step === 2 ? Boolean(d.loc && barangay) : step === 3 ? Boolean(d.title.trim()) : true

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-white shadow-lg">
      <header className="flex items-center justify-between bg-brand-900 px-4 py-3 text-white">
        <span className="font-bold">💧 Bantay Antiao</span>
        <span className="text-xs text-white/70">{role.label}</span>
      </header>

      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-green-100 text-3xl">✓</span>
          <h1 className="text-2xl font-bold text-slate-900">Report Submitted</h1>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Reference</p>
            <p className="text-xl font-bold tabular-nums text-slate-900">{done.id}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
            <p className="text-lg font-bold text-slate-700">SUBMITTED</p>
          </div>
          <p className="max-w-xs text-sm text-slate-600">
            Sent to the barangay official of <b>{done.barangay_name}, {done.municipality}</b>. They review it first and can
            forward it to the responsible office.
          </p>
          {done.urgent && <p className="max-w-xs rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{EMERGENCY_NOTE}</p>}
          <button onClick={restart} className={`${BIG} mt-2 bg-brand-500 text-center text-white`}>
            Submit another report
          </button>
          <a href="#/reports" className="text-sm font-semibold text-brand-600 underline">
            Track my reports
          </a>
        </div>
      ) : (
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-4 flex gap-1.5" aria-label={`Step ${step} of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-brand-500' : 'bg-slate-200'}`} />
            ))}
          </div>

          {step === 1 && (
            <>
              <h1 className="mb-3 text-xl font-bold text-slate-900">What is the concern?</h1>
              <div className="grid gap-2.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      set({ category: c.id })
                      setStep(2)
                    }}
                    className={`${BIG} border ${d.category === c.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
                  >
                    <span className="mr-3 text-2xl">{c.icon}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="mb-3 text-xl font-bold text-slate-900">Where is it?</h1>
              <button onClick={useGps} className={`${BIG} bg-brand-500 text-center text-white`}>
                📡 Use My Location
              </button>
              <p className="my-2 text-center text-sm text-slate-500">or tap the map to place the pin, then drag it to adjust</p>
              <div className="h-80 overflow-hidden rounded-2xl border border-slate-200">
                <PinMap value={d.loc} onPick={pick} target={target} />
              </div>
              <p className={`mt-2 min-h-5 text-sm ${locMsg ? 'text-amber-800' : 'text-slate-600'}`} role="status">
                {locMsg || (d.loc ? <span className="tabular-nums">Pin: {d.loc.lat.toFixed(5)}, {d.loc.lng.toFixed(5)}</span> : 'No pin placed yet.')}
              </p>

              <label className={LABEL}>
                Barangay <span className="font-normal text-slate-500">(your report goes to this barangay's official)</span>
                <select value={d.barangayId} onChange={(e) => chooseBarangay(e.target.value)} className={INPUT}>
                  <option value="">Choose the barangay…</option>
                  {MUNICIPALITIES.map((m) => (
                    <optgroup key={m} label={m}>
                      {BARANGAYS.filter((b) => b.municipality === m).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {d.suggested && (
                <p className="mt-1 text-xs text-slate-500">
                  The pin looks like it is in <b>{BARANGAY[d.suggested].name}, {BARANGAY[d.suggested].municipality}</b>
                  {d.suggested !== d.barangayId && d.barangayId ? ', but you chose a different barangay. Your choice is used.' : '. Please check it is right; map boundaries are approximate.'}
                </p>
              )}
              <label className={LABEL}>
                Specific location <span className="font-normal text-slate-500">(optional)</span>
                <input value={d.placeNote} onChange={(e) => set({ placeNote: e.target.value })} maxLength={120} placeholder="Sitio, landmark or nearest house" className={INPUT} />
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="mb-1 text-xl font-bold text-slate-900">Describe it</h1>
              <label className={LABEL}>
                Report title
                <input value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} placeholder={`e.g. ${CATEGORY[d.category].label} near the creek`} className={INPUT} />
              </label>
              <label className={LABEL}>
                What did you see?
                <textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} rows={4} maxLength={600} className={INPUT} />
              </label>
              <label className={`${BIG} mt-4 block cursor-pointer border-2 border-dashed border-slate-300 text-center text-slate-700`}>
                📷 {d.photo ? 'Change photo' : 'Take / Upload Photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    try {
                      set({ photo: await shrink(f) })
                      setError('')
                    } catch (err) {
                      setError(err.message)
                    }
                  }}
                />
              </label>
              {d.photo && <img src={d.photo} alt="Selected evidence" className="mt-3 max-h-48 w-full rounded-2xl object-cover" />}
              <fieldset className="mt-4">
                <legend className="text-sm font-semibold text-slate-700">How serious does it look?</legend>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {SEVERITIES.map((s) => (
                    <label key={s} className={`cursor-pointer rounded-2xl border p-3 text-center text-sm font-semibold ${d.severity === s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-700'}`}>
                      <input type="radio" name="severity" className="sr-only" checked={d.severity === s} onChange={() => set({ severity: s })} />
                      {s}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="mb-3 text-xl font-bold text-slate-900">Safety and contact</h1>
              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${d.urgent ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}>
                <input type="checkbox" checked={d.urgent} onChange={(e) => set({ urgent: e.target.checked })} className="mt-1 h-5 w-5" />
                <span>
                  <b className="block text-slate-900">Someone's life or safety is at risk right now</b>
                  <span className="text-sm text-slate-600">The report is flagged urgent and also shown to the disaster office (MDRRMO) straight away.</span>
                </span>
              </label>
              {d.urgent && (
                <p role="alert" className="mt-2 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900">
                  {EMERGENCY_NOTE}
                </p>
              )}
              <label className={LABEL}>
                Contact number or email <span className="font-normal text-slate-500">(optional)</span>
                <input value={d.contact} onChange={(e) => set({ contact: e.target.value })} maxLength={80} placeholder="So the barangay can ask you for details" className={INPUT} />
              </label>
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={d.contactShared} disabled={!d.contact.trim()} onChange={(e) => set({ contactShared: e.target.checked })} className="mt-0.5 h-4 w-4" />
                <span>Let the barangay official and the responsible office see my contact details. It is never shown to other residents or on the public map.</span>
              </label>
            </>
          )}

          {step === 5 && (
            <>
              <h1 className="mb-3 text-xl font-bold text-slate-900">Review and submit</h1>
              <dl className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Concern</dt>
                  <dd className="text-base font-semibold">{d.title}</dd>
                  <dd className="text-slate-600">{CATEGORY[d.category].icon} {CATEGORY[d.category].label} · Severity: {d.severity}{d.urgent ? ' · URGENT' : ''}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Goes to</dt>
                  <dd>Barangay official of <b>{barangay.name}, {barangay.municipality}</b></dd>
                  {d.placeNote && <dd className="text-slate-600">{d.placeNote}</dd>}
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Evidence</dt>
                  <dd>{d.photo ? 'Photo attached' : 'No photo'}{d.notes && <span className="block text-slate-600">“{d.notes}”</span>}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Contact</dt>
                  <dd>{d.contact.trim() ? (d.contactShared ? 'Shared with reviewing officials only' : 'Given, but kept private') : 'Not given'}</dd>
                </div>
              </dl>
              <button onClick={submit} disabled={busy} className={`${BIG} mt-4 bg-brand-500 text-center uppercase tracking-wide text-white disabled:opacity-60`}>
                {busy ? 'Sending…' : 'Submit Report'}
              </button>
            </>
          )}

          {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

          <div className="mt-auto flex gap-2 pt-5">
            {step > 1 ? (
              <button onClick={() => setStep(step - 1)} className="flex-1 rounded-2xl border border-slate-300 py-3 font-semibold text-slate-700">
                Back
              </button>
            ) : (
              <a href="#/" className="flex-1 rounded-2xl border border-slate-300 py-3 text-center font-semibold text-slate-700">
                Cancel
              </a>
            )}
            {step > 1 && step < 5 && (
              <button onClick={() => setStep(step + 1)} disabled={!canNext} className="flex-1 rounded-2xl bg-brand-900 py-3 font-semibold text-white disabled:bg-slate-300">
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
