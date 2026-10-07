// Public site shell: navigation bar, animated page transitions and the signed-out routes.
//   /         landing page          /map      interactive GIS hazard map
//   /about    about the system      /reports  report an issue (no account)
// The map page also holds the risk analysis (barangay pressure index, what-if land use, suggested actions).
import { useEffect, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import './home.css'
import './site.css'
import AboutSystem from '../components/AboutSystem'
import HazardRiskMap from '../components/HazardRiskMap'
import ReportIssue from '../components/ReportIssue'
import { STUDY_AREA } from '../lib/hazards'
import Landing, { TAGLINE } from './Landing'

const NAV = [
  ['/', 'Home'],
  ['/map', 'Explore Map'],
  ['/about', 'About'],
  ['/reports', 'Community Reports'],
]
/** Explore Map: the 3D hazard map, then the risk analysis for the barangay the pin is in. */
function MapPage() {
  return (
    <div className="map-page">
      <HazardRiskMap mapClass="bt map-shell" />
    </div>
  )
}

const PAGES = {
  '/': Landing,
  '/map': MapPage,
  '/about': () => (
    <div className="bt plain-shell">
      <AboutSystem />
    </div>
  ),
  '/reports': () => (
    <div className="bt plain-shell">
      <ReportIssue />
    </div>
  ),
  '/analysis': MapPage, // the old address of the analysis, kept so earlier links still open
}
export const PUBLIC_PATHS = Object.keys(PAGES)

const Drop = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path fill="currentColor" d="M16 2.500C10.500 10 6.500 14.800 6.500 20.300a9.500 9.500 0 0 0 19 0C25.500 14.800 21.500 10 16 2.500zm-4.300 18.300a1.200 1.200 0 0 1 2.400 0 2.900 2.900 0 0 0 2.900 2.900 1.200 1.200 0 0 1 0 2.400 5.300 5.300 0 0 1-5.300-5.300z" />
  </svg>
)

function Nav({ path }) {
  const [open, setOpen] = useState(false)
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    setOpen(false)
  }, [path])
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 16)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const links = (
    <>
      {NAV.map(([href, label]) => (
        <a key={href} href={`#${href}`} aria-current={path === href ? 'page' : undefined}>
          {label}
          {path === href && <motion.span layoutId="nav-underline" className="nav-underline" />}
        </a>
      ))}
    </>
  )
  return (
    <header className={`s-nav${solid || path !== '/' || open ? ' solid' : ''}`}>
      <div className="site-wrap s-nav-in">
        <a className="s-logo" href="#/" aria-label="Bantay Antiao home">
          <Drop />
          <span>
            Bantay Antiao
            <small>{STUDY_AREA}</small>
          </span>
        </a>
        <nav className="s-links" aria-label="Main">
          {links}
        </nav>
        <motion.a className="s-btn s-btn-primary s-login" href="#/login" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
          Login
        </motion.a>
        <button type="button" className="s-burger" aria-expanded={open} aria-controls="s-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
          <motion.span animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }} />
          <motion.span animate={open ? { opacity: 0 } : { opacity: 1 }} />
          <motion.span animate={open ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="s-menu"
            className="s-menu"
            aria-label="Main (mobile)"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            {NAV.map(([href, label], i) => (
              <motion.a key={href} href={`#${href}`} aria-current={path === href ? 'page' : undefined} initial={{ x: -14, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.04 * i }}>
                {label}
              </motion.a>
            ))}
            <motion.a href="#/login" className="s-menu-login" initial={{ x: -14, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.04 * NAV.length }}>
              Login
            </motion.a>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

export default function PublicSite({ path }) {
  const route = path === '/analysis' ? '/map' : PAGES[path] ? path : '/' // the analysis now lives on the map page
  const Page = PAGES[route]
  // each page starts at its top
  useEffect(() => {
    window.scrollTo(0, 0) // braces matter: newer browsers return a promise from scrollTo, and an effect may only return a cleanup function
  }, [route])
  return (
    // "user" honours the device's reduce-motion setting: transforms are dropped, fades stay
    <MotionConfig reducedMotion="user">
      <div className="site">
        <a className="s-skip" href="#content">
          Skip to content
        </a>
        <Nav path={route} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={route}
            id="content"
            className={`s-page s-page-${route === '/' ? 'home' : route === '/analysis' ? 'map' : route.slice(1)}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
          >
            <Page />
          </motion.main>
        </AnimatePresence>
        {route !== '/map' && route !== '/analysis' && (
          <footer className="s-foot">
            <div className="site-wrap">
              <p>
                <b>Bantay Antiao</b> · “{TAGLINE}” Watershed and hazard watch for {STUDY_AREA}, Samar. A student prototype, not an official government
                service, and not affiliated with or endorsed by Project NOAH.
              </p>
              <p>Hazard maps © Project NOAH, UP Resilience Institute (ODbL). Map data © OpenStreetMap contributors.</p>
            </div>
          </footer>
        )}
      </div>
    </MotionConfig>
  )
}
