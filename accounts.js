// Accounts and their verification. New sign-ups wait as "pending" until an administrator (a Municipal /
// Environmental Office account) approves them.
//   Supabase mode: accounts are rows of the `profiles` table (see supabase/schema.sql).
//   Local mode   : accounts live in this browser only, so one made on one device is not visible on another.
import { useEffect, useState } from 'react'
import { supabase, usernameTaken } from './store'

const ACCOUNTS_KEY = 'bantay-ulot:accounts'
const CHANGED = 'bantay:accounts-changed'

/** The sample administrator, created the first time the app runs in a browser. */
export const SAMPLE_ADMIN = { username: 'admin', password: 'admin123', name: 'System Administrator', role: 'admin', office: 'MENRO' }

export const USERNAME_RULE = /^[a-z0-9._-]{3,20}$/
export const cleanUsername = (text) => text.trim().toLowerCase()
// A Gmail address: 6 to 30 letters, numbers or dots before @gmail.com, not starting or ending with a dot.
export const GMAIL_RULE = /^(?!.*\.\.)[a-z0-9][a-z0-9.]{4,28}[a-z0-9]@gmail\.com$/

/** Avoids keeping the raw password in storage. A convenience for the prototype, not real security. */
export async function digest(username, password) {
  const text = `${username}:${password}`
  if (crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // crypto.subtle is unavailable on plain-http LAN addresses
  let h = 5381
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0
  return `x${h.toString(16)}`
}

export function loadAccounts() {
  let list = []
  try {
    list = JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || []
  } catch {
    list = []
  }
  // accounts made before usernames and verification existed: their email is their username, and they stay usable
  return list.map((a) => ({ ...a, username: a.username || a.email, status: a.status || 'approved' }))
}
function saveAccounts(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event(CHANGED))
}

/** Makes sure the sample administrator exists, so there is always someone who can verify sign-ups. */
export async function ensureAdmin() {
  const list = loadAccounts()
  if (list.some((a) => a.username === SAMPLE_ADMIN.username)) return
  const { password, ...rest } = SAMPLE_ADMIN
  saveAccounts([{ ...rest, barangay_id: null, hash: await digest(rest.username, password), status: 'approved', sample: true, created_at: new Date().toISOString() }, ...list])
}

/** Whether a username is already in use: true, false, or null when it cannot be checked right now. */
export async function isUsernameTaken(username) {
  if (supabase) return usernameTaken(username)
  await ensureAdmin()
  return loadAccounts().some((a) => a.username === username)
}

/** Adds a sign-up. It cannot log in until an administrator approves it. */
export async function requestAccount({ username, email, name, password, role, barangay_id, office }) {
  const list = loadAccounts()
  if (list.some((a) => a.username === username)) throw new Error('That username is already taken. Choose another one.')
  if (email && list.some((a) => a.email === email)) throw new Error('An account already uses that email address.')
  saveAccounts([...list, { username, email, name, role, barangay_id: barangay_id || null, office: office || null, hash: await digest(username, password), status: 'pending', created_at: new Date().toISOString() }])
}

/** Administrator's decision on an account: 'approved' or 'rejected'. */
export async function reviewAccount(username, status, by) {
  const patch = { status, reviewed_by: by, reviewed_at: new Date().toISOString() }
  if (supabase) {
    const { error } = await supabase.from('profiles').update(patch).eq('username', username)
    if (error) throw new Error(`The account could not be updated: ${error.message}`)
    return
  }
  saveAccounts(loadAccounts().map((a) => (a.username === username ? { ...a, ...patch } : a)))
}
/** Live list of accounts: updates when one is added or reviewed. Only an administrator receives other people's accounts. */
export function useAccounts() {
  const [list, setList] = useState(() => (supabase ? [] : loadAccounts()))
  useEffect(() => {
    if (supabase) {
      let alive = true
      const load = () => supabase.from('profiles').select('*').order('created_at').then(({ data }) => alive && setList(data || []))
      load()
      const live = supabase.channel(`profiles-${Math.random().toString(36).slice(2)}`).on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load).subscribe()
      const { data: listener } = supabase.auth.onAuthStateChange(() => setTimeout(load, 0))
      return () => {
        alive = false
        supabase.removeChannel(live)
        listener.subscription.unsubscribe()
      }
    }
    const on = () => setList(loadAccounts())
    window.addEventListener(CHANGED, on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(CHANGED, on)
      window.removeEventListener('storage', on)
    }
  }, [])
  return list
}

/** The administrator's own display name and office. (Other roles are changed by the administrator.) */
export async function updateOwnAccount(session, { name, office }) {
  if (supabase) {
    const { data, error } = await supabase.from('profiles').update({ name, office }).eq('id', session.id).select('id')
    if (error) throw new Error(`The details could not be saved: ${error.message}`)
    if (!data?.length) throw new Error('The details could not be saved: this account is not allowed to change them.')
    return
  }
  saveAccounts(loadAccounts().map((a) => (a.username === session.username ? { ...a, name, office } : a)))
}

/** Changes the signed-in person's password, after checking the current one. */
export async function changeOwnPassword(session, current, next) {
  if (supabase) {
    const { data: who } = await supabase.auth.getUser()
    if (!who?.user?.email) throw new Error('Your session has ended. Log in again and retry.')
    const check = await supabase.auth.signInWithPassword({ email: who.user.email, password: current })
    if (check.error) throw new Error(/invalid login/i.test(check.error.message) ? 'The current password is not correct.' : check.error.message)
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) throw new Error(`The password could not be changed: ${error.message}`)
    return
  }
  const list = loadAccounts()
  const mine = list.find((a) => a.username === session.username)
  if (!mine || mine.hash !== (await digest(mine.username, current))) throw new Error('The current password is not correct.')
  const hash = await digest(mine.username, next)
  saveAccounts(list.map((a) => (a === mine ? { ...a, hash } : a)))
}
