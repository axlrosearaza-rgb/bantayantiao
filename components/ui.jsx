import { LEVELS, STATUS_STYLE } from '../lib/constants'

export function StatusChip({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLE[status].chip}`}
    >
      {status}
    </span>
  )
}

export function LevelBadge({ level, suffix = '' }) {
  const l = LEVELS[level]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
      style={{ background: l.bg, color: l.text }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
      {level}
      {suffix}
    </span>
  )
}

export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm ${className}`}>
      {(title || right) && (
        <header className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h3>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

/** Small "i" with a hover / focus explanation. */
export function Info({ text }) {
  return (
    <span className="group relative inline-block align-middle">
      <button
        type="button"
        aria-label={text}
        className="grid h-4 w-4 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600"
      >
        i
      </button>
      <span className="pointer-events-none absolute right-0 top-5 z-[1200] hidden w-56 rounded-lg bg-slate-900 p-2.5 text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg group-focus-within:block group-hover:block">
        {text}
      </span>
    </span>
  )
}

const PRIORITY = {
  High: 'bg-red-50 text-red-800 ring-red-200',
  Medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  Low: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function ActionCard({ a, tag }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${PRIORITY[a.priority]}`}>
          {a.priority} priority
        </span>
        {tag && <span className="text-[10px] font-semibold uppercase text-brand-600">{tag}</span>}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-slate-900">{a.action}</p>
      {a.also.length > 0 && <p className="text-xs text-slate-500">Also consider: {a.also.join(' · ')}</p>}
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Why</p>
      <ul className="list-disc pl-4 text-xs text-slate-700">
        {a.why.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Suggested lead:</span> {a.lead}
      </p>
    </div>
  )
}
