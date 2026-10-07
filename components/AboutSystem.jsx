// What residents should know about the system: how reports travel, emergencies, reading hazard levels,
// sources, limits and privacy. Styles: .about in pages/home.css.
import { NOAH, STUDY_AREA } from '../lib/hazards'

const STEPS = [
  ['You report', 'Choose what you saw, mark it on the map, add a photo if you can. It takes under a minute and needs no account.'],
  ['Your barangay checks', 'The report goes to the official of the barangay you chose. They verify it, and either act on it or forward it.'],
  ['The right office acts', 'The MENRO, MDRRMO or another LGU office takes forwarded reports, assigns people and records what was done.'],
]
const LEVELS = [
  ['#f2c94c', 'Low', 'Flood water up to about knee height (0.5 m), or a slope where building needs continuous monitoring.'],
  ['#f2994a', 'Medium', 'Flood water from knee to neck height (0.5 m to 1.5 m), or a slope that needs protection works before building.'],
  ['#eb5757', 'High', 'Flood water deeper than 1.5 m, or a slope NOAH classes as a no-dwelling zone.'],
]

export default function AboutSystem() {
  return (
  <section className="about" id="about">
    <div className="wrap">
      <p className="eyebrow">About this system</p>
      <h2>What you should know before you rely on it.</h2>

      <div className="about-grid">
        <article className="about-card">
          <h3>What happens to your report</h3>
          <ol className="about-steps">
            {STEPS.map(([t, d], i) => (
              <li key={t}>
                <span className="mono">0{i + 1}</span>
                <div>
                  <b>{t}</b>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="about-fine">Stages: Submitted, Under Barangay Review, Verified, Forwarded to Responsible Office, Under Office Review, Action in Progress, Resolved, Closed.</p>
        </article>

        <article className="about-card about-alert">
          <h3>In an emergency</h3>
          <p>
            <b>Call 911 or your local disaster office first.</b> This site does not replace emergency hotlines, and nobody
            watches reports around the clock.
          </p>
          <p>If a report is about immediate danger, tick the urgent box so the disaster office also sees it straight away.</p>
        </article>

        <article className="about-card">
          <h3>Reading the hazard levels</h3>
          <ul className="about-levels">
            {LEVELS.map(([c, n, t]) => (
              <li key={n}>
                <i style={{ background: c }} />
                <div>
                  <b>{n}</b>
                  <p>{t}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="about-fine">“Little to none” means nothing is mapped at that exact spot. Always look at the map around the pin too.</p>
        </article>

        <article className="about-card">
          <h3>Where the information comes from</h3>
          <ul className="about-list">
            <li>
              <b>Flood, landslide and storm surge maps:</b>{' '}
              <a href={NOAH.website} target="_blank" rel="noreferrer">
                Project NOAH
              </a>
              , UP Resilience Institute. Modelled maps with files dated {NOAH.source_files_dated}, used under the Open Database License.
            </li>
            <li>
              <b>Barangay boundaries:</b> PSGC 2023 (PSA / NAMRIA). They are approximate, which is why you choose your barangay yourself.
            </li>
            <li>
              <b>Streets, buildings, schools and health facilities:</b> OpenStreetMap volunteers. Some places are missing.
            </li>
            <li>
              <b>Terrain:</b> public elevation data at about 30 m detail.
            </li>
          </ul>
        </article>

        <article className="about-card">
          <h3>What it cannot tell you</h3>
          <ul className="about-list">
            <li>It is <b>not a forecast or a warning</b>. The maps show where hazards are possible, not whether one is happening now. Follow PAGASA and your LGU for advisories.</li>
            <li>The weather simulation is an <b>illustration</b>. Only its “Extreme” step is a modelled scenario.</li>
            <li>It covers <b>{STUDY_AREA} only</b>. For other places, use the official Project NOAH website.</li>
            <li>A community report is an <b>observation</b>. It counts as evidence only after a barangay official verifies it.</li>
          </ul>
        </article>

        <article className="about-card">
          <h3>Your privacy</h3>
          <ul className="about-list">
            <li>Your name goes with your report to the barangay official and the office handling it.</li>
            <li>Your contact details are optional. If you give them, you decide whether officials may see them.</li>
            <li>Other residents and the public map never see who sent a report.</li>
          </ul>
        </article>
      </div>
    </div>
  </section>
  )
}
