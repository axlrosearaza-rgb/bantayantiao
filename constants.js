/** The system's name and official tagline. */
export const SYSTEM = 'Bantay Antiao'
export const TAGLINE = 'Mapping Risks. Mobilizing Communities. Protecting Watersheds.'

// Category ids are stored with every report (and were shared with the earlier mobile app); only labels changed here.
export const CATEGORIES = [
  { id: 'illegal_clearing', label: 'Illegal Logging / Deforestation', icon: '🌳', office: 'MENRO' },
  { id: 'turbid_water', label: 'River Pollution / Muddy Water', icon: '💧', office: 'MENRO' },
  { id: 'waste_dumping', label: 'Waste Dumping', icon: '🗑️', office: 'MENRO' },
  { id: 'flooding', label: 'Flooding', icon: '🌊', office: 'MDRRMO' },
  { id: 'erosion', label: 'Soil Erosion', icon: '⛰️', office: 'MENRO' },
  { id: 'landslide', label: 'Landslide / Environmental Hazard', icon: '🪨', office: 'MDRRMO' },
  { id: 'drying_spring', label: 'Water Shortage / Damaged Water Source', icon: '🚰', office: 'MENRO' },
  { id: 'river_obstruction', label: 'River Obstruction', icon: '🚧', office: 'MDRRMO' },
  { id: 'other', label: 'Other Watershed Concern', icon: '❓', office: 'MENRO' },
]
export const CATEGORY = new Proxy(Object.fromEntries(CATEGORIES.map((c) => [c.id, c])), {
  get: (map, id) => map[id] || map.other, // unknown ids from other clients fall back to "Other"
})

export const OFFICES = [
  { id: 'MENRO', label: 'MENRO', full: 'Municipal Environment and Natural Resources Office' },
  { id: 'MDRRMO', label: 'MDRRMO', full: 'Municipal Disaster Risk Reduction and Management Office' },
  { id: 'OTHER', label: 'Other LGU office', full: 'Other designated LGU office' },
]
export const OFFICE = Object.fromEntries(OFFICES.map((o) => [o.id, o]))
export const SEVERITIES = ['Low', 'Moderate', 'High']

// Resident → Barangay → Municipal / Environmental Office
export const STATUSES = [
  'Submitted',
  'Under Barangay Review',
  'Verified',
  'Forwarded to Responsible Office',
  'Under Office Review',
  'Action in Progress',
  'Resolved',
  'Closed',
]
// Statuses written by the earlier workflow (and still by the mobile app) are read as their nearest equivalent.
const LEGACY_STATUS = { New: 'Submitted', 'Under Review': 'Under Barangay Review', Assigned: 'Action in Progress', Rejected: 'Closed' }
export const normalizeStatus = (s) => (STATUSES.includes(s) ? s : LEGACY_STATUS[s] || 'Submitted')

// colour + marker ring style per stage
export const STATUS_STYLE = {
  Submitted: { color: '#64748b', ring: 'dashed', chip: 'bg-slate-100 text-slate-700 ring-slate-300' },
  'Under Barangay Review': { color: '#d97706', ring: 'dashed', chip: 'bg-amber-50 text-amber-800 ring-amber-300' },
  Verified: { color: '#15803d', ring: 'solid', chip: 'bg-green-50 text-green-800 ring-green-300' },
  'Forwarded to Responsible Office': { color: '#7c3aed', ring: 'solid', chip: 'bg-violet-50 text-violet-800 ring-violet-300' },
  'Under Office Review': { color: '#a21caf', ring: 'solid', chip: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-300' },
  'Action in Progress': { color: '#1d4ed8', ring: 'solid', chip: 'bg-blue-50 text-blue-800 ring-blue-300' },
  Resolved: { color: '#0f766e', ring: 'solid', chip: 'bg-teal-50 text-teal-800 ring-teal-300' },
  Closed: { color: '#94a3b8', ring: 'dotted', chip: 'bg-slate-50 text-slate-500 ring-slate-200' },
}

/**
 * Allowed moves. `by` is who may make the move:
 *   barangay – the official assigned to the report's barangay
 *   office   – staff of the office the report was forwarded to
 *   handler  – whoever is handling it (barangay if kept local, otherwise the office)
 */
export const TRANSITIONS = [
  { from: 'Submitted', to: 'Under Barangay Review', by: 'barangay', label: 'Start barangay review' },
  { from: 'Under Barangay Review', to: 'Verified', by: 'barangay', label: 'Verify report' },
  { from: 'Under Barangay Review', to: 'Closed', by: 'barangay', label: 'Close as not valid', needsNote: true, danger: true },
  { from: 'Verified', to: 'Action in Progress', by: 'barangay', label: 'Handle at barangay level' },
  { from: 'Verified', to: 'Forwarded to Responsible Office', by: 'barangay', label: 'Forward to office', needsOffice: true },
  { from: 'Forwarded to Responsible Office', to: 'Under Office Review', by: 'office', label: 'Start office review' },
  { from: 'Under Office Review', to: 'Action in Progress', by: 'office', label: 'Start action', asksAssignee: true },
  { from: 'Under Office Review', to: 'Closed', by: 'office', label: 'Close without action', needsNote: true, danger: true },
  { from: 'Action in Progress', to: 'Resolved', by: 'handler', label: 'Mark resolved', needsNote: true },
  { from: 'Resolved', to: 'Closed', by: 'handler', label: 'Close report' },
  // Urgent reports reach the disaster office at once, without waiting for barangay review.
  { from: 'Submitted', to: 'Under Office Review', by: 'urgent-office', label: 'Take urgent report now' },
  { from: 'Under Barangay Review', to: 'Under Office Review', by: 'urgent-office', label: 'Take urgent report now' },
]

const OPEN = (r) => r.status !== 'Resolved' && r.status !== 'Closed'
/** Only reports a barangay official verified, that are still open and not archived, count as evidence. */
export const isEvidence = (r) => Boolean(r.verified_at) && OPEN(r) && !r.archived_at
export const isOpen = OPEN

export const ROLES = {
  admin: {
    id: 'admin',
    label: 'Municipal / Environmental Office (Admin)',
    short: 'Office',
    user: { id: 'u-admin', name: 'Office staff' },
    // the office administers the system: it also verifies new accounts
    pages: ['dashboard', 'reports', 'accounts', 'data', 'about', 'settings'],
  },
  officer: {
    id: 'officer',
    label: 'Barangay Official / Personnel',
    short: 'Barangay',
    user: { id: 'u-officer', name: 'Barangay official' },
    pages: ['dashboard', 'reports', 'data', 'about', 'settings'],
  },
  community: {
    id: 'community',
    label: 'Resident',
    short: 'Resident',
    user: { id: 'u-community', name: 'Resident' },
    pages: ['dashboard', 'reports', 'data', 'about', 'settings'],
  },
}

// ---- access control (who sees and does what) ----
/**
 * Who may file a report from inside the system. Barangay officials and the office review and act on residents'
 * reports; they do not add their own. Residents report on the public Community Reports page.
 */
export const canAddReport = (role) => role.id === 'community'
export const isMine = (r, role) => r.reporter_id === role.user.id
export function isUrgentFor(r, role) {
  return role.id === 'admin' && role.office === 'MDRRMO' && r.urgent
}
/** Full report details (description, evidence, history). */
export function canSee(r, role) {
  if (isMine(r, role)) return true
  if (role.id === 'officer') return r.barangay_id === role.barangay_id
  if (role.id === 'admin') return r.forwarded_office === role.office || isUrgentFor(r, role) || Boolean(r.verified_at)
  return false
}
/** Internal notes, messages, assignments and the reporter's contact details. */
export function isStaffOn(r, role) {
  if (role.id === 'officer') return r.barangay_id === role.barangay_id
  if (role.id === 'admin') return r.forwarded_office === role.office || isUrgentFor(r, role)
  return false
}
/**
 * Archiving files a report away: it leaves the working lists and the map but is kept, and can be restored.
 * Only a verified report can be archived, by the official of its barangay or by the municipal office.
 */
export function canArchive(r, role) {
  if (!r.verified_at) return false
  if (role.id === 'officer') return r.barangay_id === role.barangay_id
  return role.id === 'admin'
}
export function allowedMoves(r, role) {
  return TRANSITIONS.filter((t) => {
    if (t.from !== r.status) return false
    const barangay = role.id === 'officer' && r.barangay_id === role.barangay_id
    const office = role.id === 'admin' && r.forwarded_office === role.office
    if (t.by === 'barangay') return barangay
    if (t.by === 'office') return office
    if (t.by === 'handler') return r.forwarded_office ? office : barangay
    if (t.by === 'urgent-office') return isUrgentFor(r, role) && !r.forwarded_office
    return false
  })
}
/** What a resident (or the public map) may know about someone else's verified report. */
export const publicView = (r) => ({
  id: r.id,
  category: r.category,
  status: r.status,
  latitude: r.latitude,
  longitude: r.longitude,
  area_id: r.area_id,
  barangay_id: r.barangay_id,
  barangay_name: r.barangay_name,
  municipality: r.municipality,
  created_at: r.created_at,
  verified_at: r.verified_at,
  title: r.title,
  public_only: true,
})

export const LEVELS = {
  Low: { color: '#3f9b5b', text: '#14532d', bg: '#dcfce7' },
  Moderate: { color: '#e3b505', text: '#713f12', bg: '#fef9c3' },
  High: { color: '#e8772e', text: '#7c2d12', bg: '#ffedd5' },
  Critical: { color: '#c62828', text: '#7f1d1d', bg: '#fee2e2' },
}
