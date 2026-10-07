// Landing page (route "/"): animated introduction to the system. The GIS map lives at "/map".
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import gis from '../data/gis.json'
import { BARANGAYS, NOAH, STUDY_AREA, WATERSHED_HAZARD } from '../lib/hazards'

export const SYSTEM_NAME = 'Catbalogan Watershed Prevention and Management System'
import { TAGLINE } from '../lib/constants'
export { TAGLINE } from '../lib/constants' // kept here for the pages that import it from the landing page

const rise = { hidden: { opacity: 0, y: 26 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.2, 0.7, 0.2, 1] } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }
const inView = { initial: 'hidden', whileInView: 'show', viewport: { once: true, amount: 0.2 } }

const FEATURES = [
  ['map', 'Interactive hazard map', 'A 3D map of the city with Project NOAH flood, landslide and storm surge layers. Drag the pin to read the level at any spot.'],
  ['rain', 'Weather simulation', 'Step from drought to extreme rain and see which ground collects water first and which slopes to watch.'],
  ['pin', 'Community reports', 'Residents report illegal logging, dumping, flooding and more in under a minute, with a photo and a map pin.'],
  ['route', 'Barangay-level routing', 'Each report goes to the official of the barangay the resident chooses, who can forward it to the MENRO or MDRRMO.'],
  ['shield', 'Critical facilities', 'Schools, health facilities, police and fire stations on the map, with the hazard level at each one.'],
  ['check', 'Open about its data', 'Every layer names its source and date, and the site says plainly what is modelled and what is only illustrated.'],
]
const AWARENESS = [
  ['Forests slow the water', 'Tree cover and roots hold soil and let rain soak in. Cleared slopes shed water faster and carry soil into rivers.'],
  ['What happens upstream arrives downstream', 'Dumping, clearing and erosion in upland barangays show up as muddy water and flooding in the barangays below.'],
  ['Hazard is not the same everywhere', 'Low ground near rivers floods; steep ground slides. Knowing which one you live on is the first step to preparing.'],
]
const MONITORING = [
  ['live', 'Updates as it happens', 'Community reports and their status', 'New reports and status changes appear for officials without refreshing.'],
  ['static', 'Fixed reference maps', 'Flood, landslide and storm surge hazard', `Modelled by Project NOAH; files dated ${NOAH.source_files_dated}. They do not change with today’s weather.`],
  ['none', 'Not connected yet', 'Rainfall, river level and weather sensors', 'No live sensor or forecast feed is linked. Follow PAGASA and your LGU for advisories.'],
]
const STEPS = [
  ['Report', 'Choose what you saw, mark it on the map and add a photo. No account needed.'],
  ['Barangay review', 'Your barangay official checks the report and verifies it.'],
  ['Action', 'They act locally or forward it to the MENRO, MDRRMO or another office, and the status is recorded.'],
]

const ICONS = {
  map: <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />,
  rain: <path d="M7 15a4 4 0 0 1 .5-8 5.500 5.500 0 0 1 10.500 1.500A3.500 3.500 0 0 1 17 15M8 18l-1 3M12 18l-1 3M16 18l-1 3" />,
  pin: <path d="M12 21s7-6.500 7-12a7 7 0 0 0-14 0c0 5.500 7 12 7 12zM12 11.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z" />,
  route: <path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h5a3 3 0 0 0 3-3v-1a3 3 0 0 0-3-3h-2a3 3 0 0 1-3-3V6M16 7H8" />,
  shield: <path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6zM9 12l2 2 4-4" />,
  check: <path d="M4 5h16v14H4zM8 10h8M8 14h5" />,
}
const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.800" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
)

/** Hero backdrop drawn in SVG: sky, far and near forested hills, and a river winding to the front. */
function Scene() {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const far = useTransform(scrollY, [0, 700], [0, reduce ? 0 : 70])
  const mid = useTransform(scrollY, [0, 700], [0, reduce ? 0 : 130])
  const near = useTransform(scrollY, [0, 700], [0, reduce ? 0 : 200])
  const drift = (dur, dx) => (reduce ? {} : { animate: { x: [0, dx, 0] }, transition: { duration: dur, repeat: Infinity, ease: 'easeInOut' } })
  const trees = (n, y, h, seed) =>
    Array.from({ length: n }, (_, i) => {
      const x = (i / n) * 1440 + ((i * seed) % 37)
      const s = h * (0.75 + ((i * 13 + seed) % 10) / 22)
      const base = y + Math.sin((x / 1440) * Math.PI * 2 + seed) * 16
      return <path key={i} d={`M${x} ${base}l${s * 0.42} ${-s}l${s * 0.42} ${s}z`} />
    })
  return (
    <div className="scene" aria-hidden="true">
      <div className="scene-sky" />
      <motion.div className="scene-sun" {...drift(18, 24)} />
      <motion.div className="scene-cloud c1" {...drift(40, 70)} />
      <motion.div className="scene-cloud c2" {...drift(52, -90)} />
      <motion.div className="scene-cloud c3" {...drift(46, 60)} />
      <motion.div className="scene-mist m1" {...drift(26, 90)} />
      <motion.div className="scene-mist m2" {...drift(34, -120)} />
      <motion.svg className="scene-layer" style={{ y: far }} viewBox="0 0 1440 600" preserveAspectRatio="xMidYMax slice">
        <path fill="#bfe0d3" d="M0 330C160 250 300 300 460 250S760 180 940 250s330 40 500-40V600H0z" />
        <g fill="#a9d3c3">{trees(46, 286, 26, 5)}</g>
      </motion.svg>
      <motion.svg className="scene-layer" style={{ y: mid }} viewBox="0 0 1440 600" preserveAspectRatio="xMidYMax slice">
        <path fill="#6fb596" d="M0 420C200 330 380 400 560 350S900 300 1080 360s240 30 360-20V600H0z" />
        <g fill="#4f9c7c">{trees(40, 380, 38, 11)}</g>
      </motion.svg>
      <motion.svg className="scene-layer" style={{ y: near }} viewBox="0 0 1440 600" preserveAspectRatio="xMidYMax slice">
        <path fill="#2f7d5b" d="M0 500C180 440 320 500 520 470S860 430 1040 480s260 20 400-10V600H0z" />
        <g fill="#1f6045">{trees(30, 492, 54, 3)}</g>
        <path className="scene-river" d="M700 372C640 410 780 430 720 470S560 520 640 560 760 590 700 640" />
        <path className="scene-river-shine" d="M700 372C640 410 780 430 720 470S560 520 640 560 760 590 700 640" />
      </motion.svg>
      {!reduce &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <motion.span
            key={i}
            className="scene-leaf"
            style={{ left: `${10 + i * 15}%` }}
            initial={{ y: -40, x: 0, rotate: 0, opacity: 0 }}
            animate={{ y: ['-5vh', '70vh'], x: [0, 40 - i * 12, -20 + i * 6], rotate: [0, 160, 320], opacity: [0, 0.8, 0] }}
            transition={{ duration: 13 + i * 2.2, delay: i * 2.4, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      <div className="scene-rain">
        <i className="r1" />
        <i className="r2" />
      </div>
      <div className="scene-fade" />
    </div>
  )
}

export default function Landing() {
  const stats = [
    [BARANGAYS.length, 'barangays of Catbalogan City covered'],
    ['3', 'Project NOAH hazard layers'],
    [(gis.facilities || []).length, 'critical facilities mapped'],
    [`${WATERSHED_HAZARD.landslide[2]}%`, 'of the city is high landslide hazard'],
  ]
  return (
    <>
      <section className="hero">
        <Scene />
        <motion.div className="site-wrap hero-in" variants={stagger} initial="hidden" animate="show">
          <motion.p className="tag" variants={rise}>
            {STUDY_AREA}, Samar · Philippines
          </motion.p>
          <motion.h1 variants={rise}>{SYSTEM_NAME}</motion.h1>
          <motion.p className="hero-motto" variants={rise}>
            <b>Bantay Antiao</b> · {TAGLINE}
          </motion.p>
          <motion.p className="hero-lede" variants={rise}>
            See where floods, landslides and storm surge are possible, understand what threatens the land and water around you, and
            report what you see so your barangay and the right office can act.
          </motion.p>
          <motion.div className="hero-cta" variants={rise}>
            <motion.a className="s-btn s-btn-primary" href="#/map" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              Explore Watershed Map
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8h10m0 0L8.500 3.500M13 8l-4.500 4.500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </motion.a>
            <motion.a className="s-btn s-btn-ghost" href="#/reports" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              Report an issue
            </motion.a>
          </motion.div>
          <motion.dl className="hero-stats" variants={stagger}>
            {stats.map(([n, t]) => (
              <motion.div key={t} variants={rise}>
                <dt>{n}</dt>
                <dd>{t}</dd>
              </motion.div>
            ))}
          </motion.dl>
        </motion.div>
      </section>

      <section className="band" id="features">
        <div className="site-wrap">
          <motion.div {...inView} variants={stagger}>
            <motion.p className="tag" variants={rise}>What the system does</motion.p>
            <motion.h2 variants={rise}>One place to see the risk and report the problem.</motion.h2>
          </motion.div>
          <motion.div className="cards" {...inView} variants={stagger}>
            {FEATURES.map(([icon, title, text]) => (
              <motion.article key={title} className="card" variants={rise} whileHover={{ y: -6 }}>
                <span className="card-icon"><Icon name={icon} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="band tint" id="awareness">
        <div className="site-wrap split">
          <motion.div {...inView} variants={stagger}>
            <motion.p className="tag" variants={rise}>Environmental awareness</motion.p>
            <motion.h2 variants={rise}>A watershed is everything uphill of your tap.</motion.h2>
            <motion.p className="lede" variants={rise}>
              Rain that falls on the hills behind the city runs through forest, farms and streets before it reaches a river, a spring
              or the sea. How that land is treated decides how clean the water is and how hard the floods hit.
            </motion.p>
            <motion.div className="facts" variants={stagger}>
              <motion.div variants={rise}>
                <b>{WATERSHED_HAZARD.flood[2]}%</b>
                <span>of {STUDY_AREA} is high flood hazard in NOAH’s 100-year rain map</span>
              </motion.div>
              <motion.div variants={rise}>
                <b>{WATERSHED_HAZARD.landslide[2]}%</b>
                <span>is high landslide hazard, classed as no-dwelling zones</span>
              </motion.div>
            </motion.div>
          </motion.div>
          <motion.ul className="aware" {...inView} variants={stagger}>
            {AWARENESS.map(([t, d], i) => (
              <motion.li key={t} variants={rise}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      <section className="band" id="monitoring">
        <div className="site-wrap">
          <motion.div {...inView} variants={stagger}>
            <motion.p className="tag" variants={rise}>Monitoring</motion.p>
            <motion.h2 variants={rise}>What is live, and what is not.</motion.h2>
            <motion.p className="lede" variants={rise}>We would rather show less and be right about it. Here is exactly how current each part is.</motion.p>
          </motion.div>
          <motion.div className="cards three" {...inView} variants={stagger}>
            {MONITORING.map(([kind, badge, title, text]) => (
              <motion.article key={title} className="card" variants={rise} whileHover={{ y: -6 }}>
                <span className={`badge ${kind}`}>
                  <i />
                  {badge}
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="band forest" id="community">
        <div className="site-wrap">
          <motion.div {...inView} variants={stagger}>
            <motion.p className="tag" variants={rise}>Community involvement</motion.p>
            <motion.h2 variants={rise}>The people nearest the water see it first.</motion.h2>
          </motion.div>
          <motion.ol className="steps" {...inView} variants={stagger}>
            {STEPS.map(([t, d], i) => (
              <motion.li key={t} variants={rise}>
                <span>{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </motion.li>
            ))}
          </motion.ol>
          <motion.div className="hero-cta center" {...inView} variants={rise}>
            <motion.a className="s-btn s-btn-light" href="#/reports" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              Report an issue
            </motion.a>
            <motion.a className="s-btn s-btn-outline" href="#/map" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              Explore Watershed Map
            </motion.a>
          </motion.div>
          <p className="emergency">In an emergency call 911 or your local disaster office. This site does not replace emergency hotlines.</p>
        </div>
      </section>
    </>
  )
}
