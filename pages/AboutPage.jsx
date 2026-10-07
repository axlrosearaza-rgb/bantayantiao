import { Card } from '../components/ui'
import { TAGLINE } from '../lib/constants'
import { BACKEND } from '../lib/store'

const STORY = [
  ['Where is pressure increasing?', 'One map of the watershed, coloured by the Watershed Pressure Index.'],
  ['Why is that area being flagged?', 'Six visible drivers with their scores and weights — no black box.'],
  ['What is the community observing on the ground?', 'Geotagged reports that an LGU reviewer verifies or rejects.'],
  ['How could land-use decisions affect the indicators?', 'A what-if slider that recalculates only the indicators that would change.'],
  ['What could the LGU investigate first?', 'Rule-based recommended actions, each with its reason and a suggested lead office.'],
]

const ROADMAP = [
  'Load official boundaries, land cover, DEM-derived slope, rainfall and census data',
  'Expert review of weights and thresholds; field validation',
  'Email or SMS notices to officials when a report arrives; a mail service for sign-up confirmation and password reset',
  'Offline-tolerant reporting and SMS intake',
  'Change-over-time views and printable area briefs',
]

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 overflow-y-auto p-4">
      <div className="rounded-2xl bg-brand-900 p-6 text-white">
        <h1 className="text-2xl font-bold">Bantay Antiao</h1>
        <p className="text-white/80">Integrated Watershed Decision-Support and Community Monitoring Platform</p>
        <p className="mt-3 text-lg font-medium">{TAGLINE}</p>
      </div>

      <Card title="What it helps answer">
        <ol className="space-y-2.5">
          {STORY.map(([q, a], i) => (
            <li key={q} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
              <span>
                <b className="block text-sm text-slate-900">{q}</b>
                <span className="text-sm text-slate-600">{a}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="What this prototype is — and is not">
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-slate-700">
            <li>A <b>decision-support</b> tool for evidence-based prioritisation. People make the decisions.</li>
            <li>The Watershed Pressure Index is a <b>planning indicator</b>, not a validated scientific risk model.</li>
            <li>Scenario results are <b>scenario estimates</b> for comparison, not hydrological forecasts.</li>
            <li>Reports are <b>community observations</b>. They count only after an LGU reviewer verifies them, and they do not by themselves establish cause.</li>
            <li>Unit boundaries are schematic and indicator values are illustrative until official datasets are loaded.</li>
          </ul>
        </Card>
        <Card title="Roles">
          <ul className="space-y-2 text-sm text-slate-700">
            <li><b>Resident</b> — reports a concern to their barangay with a map pin, photo and description, without an account, and checks its status with the reference number.</li>
            <li><b>Barangay Official / Personnel</b> — signs up and is approved by the office; receives reports routed to their barangay, verifies them, acts locally or forwards them to an office, and can archive verified ones.</li>
            <li><b>Municipal / Environmental Office</b> (the administrator) — approves new accounts, acts on forwarded reports, assigns personnel, records actions, resolves them, and can archive verified ones.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            In place today: accounts with administrator approval, reports, status history and photos are saved in the database. Storage mode:{' '}
            <b>{BACKEND === 'supabase' ? 'Supabase (Auth, Postgres database, Storage)' : 'local demo (this browser, realtime across tabs)'}</b>.
          </p>
        </Card>
      </div>

      <Card title="After the hackathon">
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
          {ROADMAP.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
