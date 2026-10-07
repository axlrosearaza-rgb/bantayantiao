// Shared report store: Supabase (Auth, Postgres, Storage, Realtime) when configured,
// localStorage + BroadcastChannel for an offline browser demo otherwise.
import { useSyncExternalStore } from 'react'
import { createClient } from '@supabase/supabase-js'
import gis from '../data/gis.json'
import { CATEGORY, normalizeStatus } from './constants'
import { areaAt } from './geo'
import { BARANGAY, BARANGAYS, barangayAt } from './hazards'

// Public client settings from the Supabase dashboard (Project Settings → API). The "anon" key is meant to be
// shipped in a web page: what it may do is decided by the row-level security rules in supabase/schema.sql.
// only the project's address is wanted: a pasted "/rest/v1/" ending (the dashboard shows that form too) is dropped
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/^(https?:\/\/[^/]+).*$/, '$1')
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
// "pkce": the email confirmation link comes back as ?code=… instead of in the # part of the address, which this app uses for its pages
export const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'pkce' } }) : null
export const BACKEND = supabase ? 'supabase' : 'local'

const LS_KEY = 'bantay-ulot:v3' // v3: study area moved to Catbalogan City (barangay ids changed)
const FIRST_SEQ = 241
const YEAR = new Date().getFullYear()
const ref = (seq) => `BU-${YEAR}-${String(seq).padStart(5, '0')}`

let state = { reports: [], updates: [], internal: [], scenarios: [], seq: FIRST_SEQ, ready: false, error: null }
const listeners = new Set()
const emit = () => listeners.forEach((listener) => listener())
function set(patch) {
  state = { ...state, ...patch }
  emit()
}

/** Reports written by older clients are read into the current model. */
function normalize(r) {
  const b = BARANGAY[r.barangay_id]
  return {
    ...r,
    status: normalizeStatus(r.status),
    title: r.title || CATEGORY[r.category].label,
    barangay_id: r.barangay_id || null,
    barangay_name: r.barangay_name || b?.name || null,
    municipality: r.municipality || b?.municipality || null,
    severity: r.severity || 'Moderate',
    urgent: Boolean(r.urgent),
    forwarded_office: r.forwarded_office || null,
    archived_at: r.archived_at || null,
  }
}

// ---------------------------------------------------------------- local backend
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bantay-ulot') : null

function nearestBarangay(lat, lng) {
  return (
    barangayAt(lat, lng) ||
    [...BARANGAYS].sort((a, b) => Math.hypot(a.center[0] - lat, a.center[1] - lng) - Math.hypot(b.center[0] - lat, b.center[1] - lng))[0]
  )
}

function seedReports() {
  const at = (hours) => new Date(Date.now() - hours * 3600e3).toISOString()
  const point = (area, index, dLat = 0, dLng = 0) => {
    const points = gis.samplePoints[area]
    const [lat, lng] = points[index % points.length]
    const moved = [lat + dLat, lng + dLng]
    return areaAt(moved[0], moved[1]) === area ? moved : [lat + dLat / 10, lng + dLng / 10]
  }
  // sample barangays chosen by the GIS script: A[0..2] urban, A[3..5] mid, A[6..8] upland
  const A = gis.seedAreas
  // area, point, category, status, hours ago, title, description, severity, extra
  const rows = [
    [A[6], point(A[6], 0), 'drying_spring', 'Closed', 300, 'Spring flow is weaker', 'Spring box flow noticeably weaker than last dry season.', 'Moderate', { verified: true }],
    [A[0], point(A[0], 3), 'flooding', 'Action in Progress', 100, 'Road flooded after rain', 'Road section submerged for several hours after overnight rain.', 'High', { verified: true, office: 'MDRRMO', assigned: 'MDRRMO field team' }],
    [A[1], point(A[1], 0), 'flooding', 'Closed', 70, 'Water on the road', 'Water on the road near the bridge.', 'Low', {}],
    [A[4], point(A[4], 1), 'erosion', 'Forwarded to Responsible Office', 52, 'Gully on cleared slope', 'Gully forming on a cleared slope after heavy rain.', 'High', { verified: true, office: 'MENRO' }],
    [A[5], point(A[5], 0), 'illegal_clearing', 'Verified', 48, 'Fresh clearing near the trail', 'Fresh clearing seen from the trail, trees felled and burned.', 'High', { verified: true }],
    [A[0], point(A[0], 0), 'waste_dumping', 'Under Office Review', 40, 'Waste on the river bank', 'Household waste piled on the river bank.', 'Moderate', { verified: true, office: 'MENRO' }],
    [A[4], point(A[4], 0), 'illegal_clearing', 'Under Office Review', 30, 'Cleared patch above the creek', 'Newly cleared patch, roughly half a hectare, above the creek.', 'High', { verified: true, office: 'MENRO' }],
    [A[0], point(A[0], 0, 0.003, 0.002), 'waste_dumping', 'Verified', 28, 'Dumping beside the channel', 'Plastic and sacks dumped beside the channel.', 'Moderate', { verified: true }],
    [A[7], point(A[7], 0), 'landslide', 'Under Barangay Review', 26, 'Small landslip by the farm path', 'Small landslip beside the farm path.', 'Moderate', {}],
    [A[3], point(A[3], 1), 'turbid_water', 'Action in Progress', 20, 'River brown for three days', 'River has stayed brown for three days without rain.', 'Moderate', { verified: true }],
    [A[2], point(A[2], 1), 'waste_dumping', 'Submitted', 8, 'Garbage burning near stream', 'Garbage burning close to the stream.', 'Low', {}],
    [A[0], point(A[0], 0, -0.003, 0.003), 'waste_dumping', 'Under Barangay Review', 6, 'More waste downstream', 'More waste appearing downstream of the earlier site.', 'Moderate', {}],
    [A[4], point(A[4], 2), 'turbid_water', 'Under Barangay Review', 5, 'Muddy creek below clearing', 'Creek is muddy below the newly cleared area.', 'Moderate', {}],
    [A[3], point(A[3], 0), 'river_obstruction', 'Submitted', 2, 'Logs blocking the channel', 'Fallen logs and debris blocking part of the channel. Water is backing up toward houses.', 'High', { urgent: true }],
    [A[8], point(A[8], 0), 'illegal_clearing', 'Submitted', 0.17, 'Chainsaw sounds near the river', 'Chainsaw sounds and a newly opened area near the river.', 'Moderate', {}],
  ]
  const start = FIRST_SEQ - rows.length
  return rows.map(([area_id, [latitude, longitude], category, status, hours, title, description, severity, x], index) => {
    const b = nearestBarangay(latitude, longitude)
    return {
      id: ref(start + index),
      reporter_id: 'seed-resident',
      reporter_name: 'Resident (sample)',
      area_id,
      barangay_id: b.id,
      barangay_name: b.name,
      municipality: b.municipality,
      place_note: '',
      title,
      category,
      description,
      severity,
      urgent: Boolean(x.urgent),
      contact: '',
      contact_shared: false,
      latitude: +latitude.toFixed(5),
      longitude: +longitude.toFixed(5),
      photo_url: null,
      status,
      created_at: at(hours),
      verified_at: x.verified ? at(hours * 0.7) : null,
      verified_by: x.verified ? 'Barangay official (sample)' : null,
      forwarded_office: x.office || null,
      forwarded_at: x.office ? at(hours * 0.5) : null,
      assigned_to: x.assigned || null,
      demo_seed: true,
    }
  })
}

function localLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      return { ...data, internal: data.internal || [], reports: data.reports.map(normalize) }
    }
  } catch {
    // Storage can be unavailable in private browsing; use an in-memory seed.
  }
  const fresh = { reports: seedReports(), updates: [], internal: [], scenarios: [], seq: FIRST_SEQ }
  localSave(fresh)
  return fresh
}
function localSave(data) {
  const { reports, updates, internal, scenarios, seq } = data
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ reports, updates, internal, scenarios, seq }))
  } catch (error) {
    console.warn('Could not persist to localStorage', error)
  }
  channel?.postMessage('changed')
}
function localCommit(patch) {
  const current = localLoad()
  const next = { ...current, ...patch(current) }
  localSave(next)
  set(next)
}

// ---------------------------------------------------------------- Supabase backend
// People log in with a username. Supabase Auth signs in by email, so the username is first looked up to get
// the email address the person signed up with. Supabase mails a confirmation link to that address ("Confirm
// email" must be ON in the project: Authentication → Sign In / Providers → Email).
/**
 * Whether an account already uses this username: true, false, or null when it cannot be told (a database set up
 * before the lookup existed, or no connection).
 */
export async function usernameTaken(username) {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('login_email', { p_username: username })
  return error ? null : Boolean(data)
}

/** Sign-in errors in plain words. */
const authMessage = (error, taken) =>
  /failed to fetch|network/i.test(error.message)
    ? 'Could not reach the server. Check your internet connection and try again.'
    : /invalid login/i.test(error.message)
      ? 'That username or password is incorrect.'
      : /not confirmed/i.test(error.message)
        ? 'Confirm your email first: open the link that was sent to your Gmail, then log in again.'
        : /error sending .*email/i.test(error.message)
          ? 'The email could not be sent. The mail service of this system is not set up to reach this address yet; tell the administrator.'
          : /rate limit/i.test(error.message)
            ? 'Too many emails were requested just now. Wait a few minutes and try again.'
      : /already registered/i.test(error.message)
        ? taken
        : /database error saving new user/i.test(error.message)
          ? 'That username is already taken. Choose another one.'
        : error.message
const fail = (error, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
}

/** The profile row of an account, or null if it has none. */
export async function getUserProfile(uid) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
  fail(error, 'Could not load the account')
  return data
}
/** The session object the app keeps for a signed-in, approved account. */
export const sessionOf = (profile) => ({
  id: profile.id,
  roleId: profile.role,
  username: profile.username,
  name: profile.name,
  barangay_id: profile.barangay_id || null,
  office: profile.office || null,
})

export async function supabaseSignIn(username, password) {
  if (!supabase) throw new Error('Supabase is not configured.')
  let email = username
  let guessed = false // true when the username could not be looked up and the old fixed address is tried instead
  if (!username.includes('@')) {
    const found = await supabase.rpc('login_email', { p_username: username })
    if (found.error && (found.error.code === 'PGRST202' || /could not find the function/i.test(found.error.message))) {
      email = `${username}@users.bantaytubig.app`
      guessed = true
    } else if (found.error) throw new Error(authMessage(found.error))
    else email = found.data
  }
  if (!email) throw new Error('No account uses this username. Sign up first.')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error && guessed && /invalid login/i.test(error.message))
    throw new Error('Logging in by username is not switched on yet. Type the Gmail address you signed up with instead of the username.')
  if (error) throw new Error(authMessage(error))
  const profile = await getUserProfile(data.user.id)
  if (!profile || profile.status !== 'approved') {
    await supabase.auth.signOut()
    throw new Error(
      profile?.status === 'rejected'
        ? 'An administrator did not approve this account. Contact the Municipal / Environmental Office.'
        : 'Your account is waiting for an administrator to verify it. You can log in once it is approved.',
    )
  }
  return sessionOf(profile)
}

/**
 * Creates the account as "pending" and has Supabase mail a confirmation link to the email address. The person
 * can log in only after opening that link AND being approved by an administrator.
 */
export async function supabaseSignUp({ username, email, name, password, role, barangay_id, office }) {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (await usernameTaken(username)) throw new Error('That username is already taken. Choose another one.')
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, name, role, barangay_id: barangay_id || null, office: office || null },
      emailRedirectTo: window.location.origin + window.location.pathname, // the link in the email comes back here
    },
  })
  if (error) throw new Error(authMessage(error, 'An account already uses that email address.'))
  // for an address that already has an account, Supabase answers with an empty stand-in instead of an error
  if (data.user && data.user.identities?.length === 0) throw new Error('An account already uses that email address.')
  // a session straight away means the project does not ask for email confirmation
  const needsEmail = !data.session
  await supabase.auth.signOut()
  return { needsEmail }
}

/**
 * Forgot password: has Supabase email a reset link to the address the account signed up with. The link is the
 * only way to set a new password, so whoever controls that mailbox controls the reset.
 * Returns the address with most of it hidden, to show where the link went.
 */
export async function requestPasswordReset(identifier) {
  if (!supabase) throw new Error('Resetting a password by email needs the online database. Ask the administrator to help you.')
  const hide = (address) => {
    const [namePart, domain] = address.split('@')
    return `${namePart.slice(0, 2)}${'•'.repeat(Math.max(3, namePart.length - 2))}@${domain}`
  }
  const send = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${window.location.pathname}?reset=1` })
    if (error) throw new Error(authMessage(error))
  }
  // An email address needs no lookup. Supabase does not say whether an account uses it (so strangers cannot
  // find out who is registered), which is why the message below is worded as "if".
  if (identifier.includes('@')) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier)) throw new Error('That is not a complete email address.')
    await send(identifier)
    return { sentTo: identifier, certain: false }
  }
  // A username is first matched to the email the account signed up with.
  const found = await supabase.rpc('login_email', { p_username: identifier })
  if (found.error && (found.error.code === 'PGRST202' || /could not find the function/i.test(found.error.message)))
    throw new Error('Looking up an account by username is not available yet. Type the Gmail address you signed up with instead.')
  if (found.error) throw new Error(authMessage(found.error))
  if (!found.data) throw new Error('No account uses this username.')
  if (found.data.endsWith('@users.bantaytubig.app'))
    throw new Error('This account was created without a real email address, so a reset link cannot be sent. Ask the administrator to help you.')
  await send(found.data)
  return { sentTo: hide(found.data), certain: true }
}
/** Sets the new password. Only works in the browser that has just come back from the reset link. */
export async function setNewPassword(password) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('This reset link is no longer valid, or it was opened in a different browser. Ask for a new link from the log-in page.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(authMessage(error))
  await supabase.auth.signOut()
}

/**
 * Handles the return from the confirmation link in the email (the address then carries ?code=… or ?error=…).
 * Returns a message for the person, or null when this page load is not such a return.
 */
export async function finishEmailConfirmation() {
  const query = new URLSearchParams(window.location.search)
  if (!supabase || !(query.has('code') || query.has('error') || query.has('error_description'))) return null
  const problem = query.get('error_description') || query.get('error')
  await supabase.auth.getSession() // lets the client finish reading the link first
  if (query.has('reset')) {
    // back from a password reset link: stay signed in just long enough to set the new password
    window.history.replaceState(null, '', window.location.pathname + (problem ? '#/login' : '#/reset'))
    if (!problem) return { reset: true }
    await supabase.auth.signOut()
    return { ok: false, text: `The reset link did not work (${problem}). Ask for a new one with "Forgot password?".` }
  }
  await supabase.auth.signOut()
  window.history.replaceState(null, '', window.location.pathname + '#/login')
  return problem
    ? { ok: false, text: `The confirmation link did not work (${problem}). Sign up again to get a new link.` }
    : { ok: true, text: 'Your email is confirmed. An administrator still has to approve your account before you can log in.' }
}

export function supabaseSignOut() {
  return supabase ? supabase.auth.signOut() : Promise.resolve()
}

// Reports, their status history and staff notes, as far as the signed-in account may see them (the database
// decides that). Reloaded whenever one of those tables changes.
let live = null
let loadSequence = 0
async function loadSupabase() {
  const mine = ++loadSequence
  const [reports, updates, internal, scenarios] = await Promise.all([
    supabase.from('reports').select('*').order('created_at', { ascending: false }),
    supabase.from('report_updates').select('*').order('created_at'),
    supabase.from('report_internal').select('*').order('created_at'),
    supabase.from('scenarios').select('*').order('created_at'),
  ])
  if (mine !== loadSequence) return
  const error = reports.error || updates.error || internal.error
  set({
    reports: (reports.data || []).map(normalize),
    updates: updates.data || [],
    internal: internal.data || [],
    // each row keeps the scenario in its `data` column; a failed load only means none are listed
    scenarios: (scenarios.data || []).map((row) => ({ ...row.data, id: row.id, created_at: row.created_at })),
    ready: true,
    error: error ? `Could not load reports: ${error.message}` : null,
  })
}
function attachSupabase(user) {
  if (live) supabase.removeChannel(live)
  live = null
  loadSequence++
  if (!user) return set({ reports: [], updates: [], internal: [], scenarios: [], ready: true, error: null })
  let timer
  const soon = () => {
    clearTimeout(timer)
    timer = setTimeout(loadSupabase, 250)
  }
  live = supabase.channel(`reports-${user.id}`)
  for (const table of ['reports', 'report_updates', 'report_internal']) live.on('postgres_changes', { event: '*', schema: 'public', table }, soon)
  live.subscribe()
  loadSupabase()
}

if (supabase) {
  state = { ...state, ready: true }
  // the callback must not call Supabase itself, so the work is deferred
  supabase.auth.onAuthStateChange((_event, session) => setTimeout(() => attachSupabase(session?.user || null), 0))
} else {
  state = { ...state, ...localLoad(), ready: true }
  const refresh = () => set(localLoad())
  channel?.addEventListener('message', refresh)
  window.addEventListener('storage', (event) => event.key === LS_KEY && refresh())
}

// ---------------------------------------------------------------- public API
export function useStore() {
  return useSyncExternalStore(
    (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    () => state,
  )
}

/**
 * Submit a resident report. It is routed to the barangay the resident explicitly selected
 * (never from GPS alone) and starts as "Submitted": it is not evidence until a barangay official verifies it.
 */
export async function submitReport({ title, category, latitude, longitude, description, photo, user, barangay, placeNote, severity, urgent, contact, contactShared }) {
  if (!barangay) throw new Error('Choose the barangay so the report reaches the right official.')
  const base = {
    reporter_name: user.name,
    area_id: areaAt(latitude, longitude),
    barangay_id: barangay.id,
    barangay_name: barangay.name,
    municipality: barangay.municipality,
    place_note: placeNote?.trim() || '',
    title: title?.trim() || CATEGORY[category].label,
    category,
    description: description?.trim() || '',
    severity: severity || 'Moderate',
    urgent: Boolean(urgent),
    contact: contact?.trim() || '',
    contact_shared: Boolean(contact?.trim() && contactShared),
    latitude: +latitude.toFixed(5),
    longitude: +longitude.toFixed(5),
    status: 'Submitted',
    created_at: new Date().toISOString(),
    verified_at: null,
    verified_by: null,
    forwarded_office: null,
    forwarded_at: null,
    assigned_to: null,
  }
  if (supabase) {
    let photo_url = null
    if (photo) {
      // crypto.randomUUID only exists on https and localhost; phones opening the site by IP address need the fallback
      const file = `${crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`}.jpg`
      const blob = await (await fetch(photo)).blob()
      const up = await supabase.storage.from('report-photos').upload(file, blob, { contentType: 'image/jpeg' })
      fail(up.error, 'The photo could not be uploaded')
      photo_url = supabase.storage.from('report-photos').getPublicUrl(file).data.publicUrl
    }
    // the database gives the report its reference number and always starts it as "Submitted"
    const { data, error } = await supabase.rpc('submit_report', { p: { ...base, reporter_id: user.id, photo_url } })
    fail(error, 'The report could not be saved')
    return normalize(data)
  }

  let row
  localCommit((current) => {
    row = {
      ...base,
      id: ref(current.seq),
      reporter_id: user.id,
      photo_url: photo || null,
    }
    return { reports: [row, ...current.reports], seq: current.seq + 1 }
  })
  return row
}

/**
 * Move a report along the workflow. Writes the public status history and, when there are
 * notes or an assignment, a staff-only internal entry.
 */
export async function setStatus(report, move, role, { notes = '', office = null, assigned_to = '' } = {}) {
  const now = new Date().toISOString()
  const user = role.user
  const patch = { status: move.to }
  if (move.to === 'Verified') Object.assign(patch, { verified_at: now, verified_by: user.name })
  if (move.to === 'Forwarded to Responsible Office') Object.assign(patch, { forwarded_office: office, forwarded_at: now })
  // an urgent report taken directly by the disaster office is now that office's to handle
  if (move.by === 'urgent-office') Object.assign(patch, { forwarded_office: role.office, forwarded_at: now })
  if (assigned_to.trim()) patch.assigned_to = assigned_to.trim()

  const update = { report_id: report.id, old_status: report.status, new_status: move.to, by_role: role.short, created_at: now }
  const detail = [notes.trim(), office ? `Forwarded to ${office}` : '', assigned_to.trim() ? `Assigned to ${assigned_to.trim()}` : ''].filter(Boolean).join(' · ')
  const internal = detail && {
    report_id: report.id,
    type: 'status',
    text: `${report.status} → ${move.to}. ${detail}`,
    user_name: user.name,
    by_role: role.short,
    created_at: now,
  }

  if (supabase) {
    fail((await supabase.from('reports').update(patch).eq('id', report.id)).error, 'The status could not be changed')
    fail((await supabase.from('report_updates').insert({ ...update, user_id: user.id })).error, 'The status history could not be saved')
    if (internal) fail((await supabase.from('report_internal').insert({ ...internal, user_id: user.id })).error, 'The note could not be saved')
    return
  }
  localCommit((current) => ({
    reports: current.reports.map((item) => (item.id === report.id ? { ...item, ...patch } : item)),
    updates: [...current.updates, { ...update, id: `${report.id}-u${current.updates.length + 1}`, user_id: user.id }],
    internal: internal ? [...current.internal, { ...internal, id: `${report.id}-i${current.internal.length + 1}`, user_id: user.id }] : current.internal,
  }))
}

/**
 * Staff-only entry on a report: a message between barangay and office, an action taken,
 * an assignment, or a scheduled follow-up. Residents never see these.
 */
export async function addInternal(report, role, { type, text, assigned_to = '', due_date = '' }) {
  const entry = {
    report_id: report.id,
    type,
    text: text.trim(),
    ...(assigned_to.trim() && { assigned_to: assigned_to.trim() }),
    ...(due_date && { due_date }),
    user_name: role.user.name,
    by_role: role.short,
    created_at: new Date().toISOString(),
  }
  const patch = type === 'assignment' && assigned_to.trim() ? { assigned_to: assigned_to.trim() } : null
  if (supabase) {
    fail((await supabase.from('report_internal').insert({ ...entry, user_id: role.user.id })).error, 'The entry could not be saved')
    if (patch) fail((await supabase.from('reports').update(patch).eq('id', report.id)).error, 'The assignment could not be saved')
    return
  }
  localCommit((current) => ({
    reports: patch ? current.reports.map((item) => (item.id === report.id ? { ...item, ...patch } : item)) : current.reports,
    internal: [...current.internal, { ...entry, id: `${report.id}-i${current.internal.length + 1}`, user_id: role.user.id }],
  }))
}

/** Archive a verified report, or bring an archived one back. Recorded in the staff notes. */
export async function setArchived(report, role, archived) {
  const now = new Date().toISOString()
  const patch = { archived_at: archived ? now : null, archived_by: archived ? role.user.name : null }
  const note = {
    report_id: report.id,
    type: 'status',
    text: archived ? 'Archived the report.' : 'Restored the report from the archive.',
    user_name: role.user.name,
    by_role: role.short,
    created_at: now,
  }
  if (supabase) {
    const { error } = await supabase.from('reports').update(patch).eq('id', report.id)
    if (error && /archived_at|archived_by|column/i.test(error.message))
      throw new Error('Archiving is not switched on yet: the database still needs its update (run supabase/update.sql in the Supabase SQL Editor).')
    fail(error, 'The report could not be archived')
    fail((await supabase.from('report_internal').insert({ ...note, user_id: role.user.id })).error, 'The note could not be saved')
    return
  }
  localCommit((current) => ({
    reports: current.reports.map((item) => (item.id === report.id ? { ...item, ...patch } : item)),
    internal: [...current.internal, { ...note, id: `${report.id}-i${current.internal.length + 1}`, user_id: role.user.id }],
  }))
}

export async function saveScenario(row) {
  const record = { ...row, created_at: new Date().toISOString() }
  if (supabase) {
    fail((await supabase.from('scenarios').insert({ data: record })).error, 'The scenario could not be saved')
    loadSupabase() // so the saved scenario is listed straight away
    return
  }
  localCommit((current) => ({
    scenarios: [...(current.scenarios || []), record],
  }))
}

/** Local demo mode only: restore the seeded demo reports. */
export function resetDemo() {
  if (supabase) return
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    // The in-memory demo can still be reset if browser storage is unavailable.
  }
  set(localLoad())
}

/**
 * A report looked up by its reference number, as a resident may see it: id, category, barangay and status.
 * Local mode can only find reports made in this browser.
 */
export async function findReport(reference) {
  const key = reference.trim().toLowerCase()
  if (!key) return null
  if (!supabase) return state.reports.find((r) => r.id.toLowerCase() === key) || null
  const { data, error } = await supabase.rpc('report_status', { p_ref: key })
  fail(error, 'The report could not be looked up')
  return data?.[0] || null
}
