// Animated background shared by the home page and the sign-up / log-in pages.

/**
 * Drifting contour lines + river particles on a canvas covering the `hero` element.
 * With `followWindow`, the hero is a fixed full-window backdrop that cannot receive the mouse itself,
 * so the ripple follows the pointer anywhere in the window.
 * Colours come from the --contour / --particle variables on `root`. Returns a cleanup function.
 */
export function initTopo(root, hero, cv, { followWindow = false } = {}) {
  const ac = new AbortController()
  const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal: ac.signal })
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const observers = []
  let alive = true
  const ctx = cv.getContext('2d')
  let W = 0
  let H = 0
  let S = 0
  let contour = '15,94,99'
  let particle = '23,128,138'
  const mouse = { x: -999, y: -999, k: 0, on: false }
  const peaks = [
    { x: 0.74, y: 0.34, r: 0.5, p: 0 },
    { x: 0.16, y: 0.86, r: 0.4, p: 2.1 },
    { x: 1.02, y: 1.0, r: 0.36, p: 4.2 },
  ]
  const rivers = [
    { x0: 0.58, dx: 0.16, amp: 0.05, f: 5.2, ph: 0.3 },
    { x0: 0.8, dx: -0.2, amp: 0.06, f: 4.1, ph: 1.9 },
    { x0: 0.3, dx: 0.12, amp: 0.04, f: 6.0, ph: 3.4 },
  ]
  let dots = []
  let running = false
  let last = 0
  let inView = true

  const readTheme = () => {
    const cs = getComputedStyle(root)
    contour = cs.getPropertyValue('--contour').trim() || contour
    particle = cs.getPropertyValue('--particle').trim() || particle
  }
  function draw(t, dt) {
    ctx.clearRect(0, 0, W, H)
    mouse.k += ((mouse.on ? 1 : 0) - mouse.k) * 0.06
    ctx.lineJoin = 'round'
    for (const c of peaks) {
      const cx = c.x * W
      const cy = c.y * H
      for (let k = 1; k <= 11; k++) {
        const base = (c.r * S * k) / 11
        ctx.beginPath()
        for (let i = 0; i <= 84; i++) {
          const a = (i / 84) * Math.PI * 2
          const n =
            Math.sin(a * 3 + c.p + t * 0.00011 + k * 0.5) * 0.06 +
            Math.sin(a * 5 - t * 0.00007 + k) * 0.032 +
            Math.sin(a * 2 + k * 0.9 + t * 0.00005) * 0.05
          let x = cx + Math.cos(a) * base * (1 + n) * 1.25
          let y = cy + Math.sin(a) * base * (1 + n) * 0.85
          if (mouse.k > 0.01) {
            const dx = x - mouse.x
            const dy = y - mouse.y
            const d = Math.hypot(dx, dy) || 1
            if (d < 240) {
              const w = Math.sin(d * 0.045 - t * 0.0035) * 11 * (1 - d / 240) * mouse.k
              x += (dx / d) * w
              y += (dy / d) * w
            }
          }
          if (i) ctx.lineTo(x, y)
          else ctx.moveTo(x, y)
        }
        ctx.strokeStyle = `rgba(${contour},${k % 4 === 0 ? 0.36 : 0.2})`
        ctx.lineWidth = k % 4 === 0 ? 1.3 : 0.9
        ctx.stroke()
      }
    }
    for (const d of dots) {
      d.u += d.v * dt
      if (d.u > 1) d.u -= 1
      const r = rivers[d.r]
      const x = (r.x0 + r.dx * d.u + Math.sin(d.u * r.f + r.ph) * r.amp * (0.4 + d.u)) * W
      ctx.beginPath()
      ctx.arc(x + d.off * (0.5 + d.u), (-0.04 + d.u * 1.08) * H, d.s, 0, 6.283)
      ctx.fillStyle = `rgba(${particle},${0.55 * Math.sin(Math.PI * d.u)})`
      ctx.fill()
    }
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    W = hero.clientWidth
    H = hero.clientHeight
    S = Math.max(W, H)
    cv.width = W * dpr
    cv.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    dots = Array.from({ length: W < 700 ? 45 : 100 }, (_, i) => ({
      r: i % rivers.length,
      u: Math.random(),
      v: 0.018 + Math.random() * 0.03,
      off: (Math.random() - 0.5) * 22,
      s: 1 + Math.random() * 1.4,
    }))
    if (!running) draw(performance.now(), 0)
  }
  function loop(t) {
    if (!running) return
    // the 3D map needs the frame budget while it is being moved, so the background holds still then
    if (!document.documentElement.dataset.mapBusy) draw(t, Math.min(0.05, (t - last) / 1000))
    last = t
    requestAnimationFrame(loop)
  }
  // run only while visible, on screen and motion is allowed
  function sync() {
    const should = alive && !reduced.matches && !document.hidden && inView
    if (should && !running) {
      running = true
      last = performance.now()
      requestAnimationFrame(loop)
    } else if (!should) running = false
  }
  on(followWindow ? window : hero, 'mousemove', (e) => {
    const r = hero.getBoundingClientRect()
    mouse.x = e.clientX - r.left
    mouse.y = e.clientY - r.top
    mouse.on = true
  })
  on(followWindow ? document.documentElement : hero, 'mouseleave', () => (mouse.on = false))
  const heroIo = new IntersectionObserver(([e]) => {
    inView = e.isIntersecting
    sync()
  })
  heroIo.observe(hero)
  observers.push(heroIo)
  on(document, 'visibilitychange', sync)
  on(reduced, 'change', () => {
    sync()
    if (reduced.matches) draw(0, 0)
  })
  on(matchMedia('(prefers-color-scheme: dark)'), 'change', () => {
    readTheme()
    if (!running) draw(0, 0)
  })
  on(window, 'resize', resize)
  readTheme()
  resize()
  sync()


  return () => {
    alive = false
    running = false
    ac.abort()
    observers.forEach((o) => o.disconnect())
  }
}
