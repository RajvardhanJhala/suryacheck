import { useEffect, useRef } from 'react'
import { reducedMotion } from '../ui/geometry'
import { caption, dayLabel, DAYS, lostPerMonth, MAX_LOSS, outputPct, sceneAt, type Scene } from './dustScene'

const W = 400, H = 220, MAX_P = 600, CLOTH = 24, IDLE_MS = 3000, GRID_X = 40, GRID_Y = 22

function mulberry32(seed: number) {
  let a = seed
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

type P = { x: number; y: number; r: number; a: number; at: number }
/** Seeded, so the dust settles the same way every time: clumps, varied sizes, denser toward the bottom edge. */
function particles(): P[] {
  const rnd = mulberry32(20261011)
  const g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5
  const centres = Array.from({ length: 40 }, () => ({ x: rnd(), y: 1 - Math.pow(rnd(), 1.8) }))
  return Array.from({ length: MAX_P }, (_, i) => {
    const c = centres[i % centres.length], clumped = i % 3 !== 0
    return {
      x: clamp01(clumped ? c.x + g() * 0.07 : rnd()) * W,
      y: clamp01(clumped ? c.y + g() * 0.06 : 1 - Math.pow(rnd(), 1.5)) * H,
      r: 1.6 + Math.pow(rnd(), 2.5) * 6.5, a: 0.35 + rnd() * 0.5, at: Math.pow(rnd(), 0.7),
    }
  })
}
const PARTICLES = particles()

function offscreen(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

/** Draws one frame of the panel into a canvas sized to its CSS box (devicePixelRatio-aware). */
class Renderer {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D
  base!: HTMLCanvasElement; dust!: HTMLCanvasElement; mask!: HTMLCanvasElement; sprite: HTMLCanvasElement
  scale = 1
  constructor(canvas: HTMLCanvasElement, ochre: string) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d')!
    this.sprite = offscreen(32, 32)
    const s = this.sprite.getContext('2d')!, grad = s.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, ochre); grad.addColorStop(0.55, ochre + 'aa'); grad.addColorStop(1, ochre + '00')
    s.fillStyle = grad; s.fillRect(0, 0, 32, 32)
    this.resize()
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = this.canvas.clientWidth || W
    this.scale = (w / W) * dpr
    this.canvas.width = Math.round(W * this.scale); this.canvas.height = Math.round(H * this.scale)
    const mask = this.mask
    this.base = offscreen(this.canvas.width, this.canvas.height); this.dust = offscreen(this.canvas.width, this.canvas.height)
    this.mask = offscreen(this.canvas.width, this.canvas.height)
    if (mask) this.mask.getContext('2d')!.drawImage(mask, 0, 0, this.mask.width, this.mask.height)
    const b = this.base.getContext('2d')!
    b.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    b.fillStyle = '#2b3640'; b.beginPath(); b.roundRect(0, 0, W, H, 10); b.fill()
    const cols = 4, rows = 2, gap = 6, mw = (W - gap * (cols + 1)) / cols, mh = (H - gap * (rows + 1)) / rows
    for (let i = 0; i < cols * rows; i++) {
      const x = gap + (i % cols) * (mw + gap), y = gap + Math.floor(i / cols) * (mh + gap)
      b.fillStyle = '#1f4a6b'; b.beginPath(); b.roundRect(x, y, mw, mh, 3); b.fill()
      b.strokeStyle = '#3d6d91'; b.lineWidth = 0.8; b.beginPath()
      for (let k = 1; k < 6; k++) { b.moveTo(x + (mw * k) / 6, y); b.lineTo(x + (mw * k) / 6, y + mh) }
      for (let k = 1; k < 4; k++) { b.moveTo(x, y + (mh * k) / 4); b.lineTo(x + mw, y + (mh * k) / 4) }
      b.stroke()
    }
  }
  wipe(x: number, y: number) {
    const m = this.mask.getContext('2d')!
    m.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    const grad = m.createRadialGradient(x, y, 0, x, y, CLOTH)
    grad.addColorStop(0, '#fff'); grad.addColorStop(0.7, '#fffc'); grad.addColorStop(1, '#fff0')
    m.fillStyle = grad; m.beginPath(); m.arc(x, y, CLOTH, 0, Math.PI * 2); m.fill()
  }
  clearMask() { this.mask.getContext('2d')!.clearRect(0, 0, this.mask.width, this.mask.height) }

  /** dust: 0..1 of the full dry-spell layer. */
  draw(s: Scene, t: number, opt: { cloth?: { x: number; y: number } | null; wiping?: boolean } = {}) {
    const { ctx } = this, dust = s.loss / MAX_LOSS
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.drawImage(this.base, 0, 0)
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    // A periodic glint across the glass, fading as dust builds (and trailing the squeegee).
    const sweep = s.phase === 'end' && s.ending === 'clean' ? s.k * (W + 80) - 40 : null
    const gx = sweep ?? ((t / 2600) % 1.6) * (W + 160) - 80
    const ga = sweep !== null ? 0.4 : 0.28 * (1 - dust)
    if (ga > 0.01) {
      const grad = ctx.createLinearGradient(gx - 40, 0, gx + 40, H)
      grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.5, `rgba(255,255,255,${ga})`); grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, W, H, 10); ctx.clip(); ctx.fillStyle = grad
      ctx.fillRect(sweep !== null ? 0 : gx - 60, 0, sweep !== null ? Math.max(0, gx) : 120, H); ctx.restore()
    }
    // Dust particles, drawn on their own layer so wiping can cut through them.
    const d = this.dust.getContext('2d')!
    d.setTransform(1, 0, 0, 1, 0, 0); d.clearRect(0, 0, this.dust.width, this.dust.height)
    d.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    const raining = s.phase === 'end' && s.ending === 'rain'
    const level = s.phase === 'end' ? 1 : dust
    // The blue dulls as dust builds: a film on the same layer, so wiping, rain and the squeegee clear it too.
    const film = 0.42 * (s.phase === 'end' ? (raining ? 1 - s.k : 1) : dust)
    if (film > 0.005) {
      const fg = d.createLinearGradient(0, 0, 0, H)
      fg.addColorStop(0, `rgba(160, 128, 84, ${film * 0.7})`); fg.addColorStop(1, `rgba(160, 128, 84, ${film})`)   // heavier at the bottom edge
      d.fillStyle = fg; d.beginPath(); d.roundRect(sweep ?? 0, 0, W - Math.max(0, sweep ?? 0), H, 10); d.fill()
    }
    for (const p of PARTICLES) {
      if (p.at > level) continue
      let y = p.y, a = p.a
      if (raining) { y += s.k * s.k * (H - p.y + 30) * (0.6 + p.at * 0.6); a *= 1 - s.k }       // runs off downwards
      if (sweep !== null && p.x < sweep) continue
      d.globalAlpha = a; d.drawImage(this.sprite, p.x - p.r, y - p.r, p.r * 2, p.r * 2)
    }
    d.globalAlpha = 1
    if (opt.wiping) { d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'destination-out'; d.drawImage(this.mask, 0, 0); d.globalCompositeOperation = 'source-over' }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.dust, 0, 0); ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    if (raining) {                                                                              // rain streaks
      ctx.strokeStyle = 'rgba(220, 235, 245, 0.55)'; ctx.lineWidth = 1.2; ctx.beginPath()
      for (let i = 0; i < 46; i++) {
        const x = (i * 97.3) % W, y = ((i * 53.1 + t * 0.55) % (H + 40)) - 20
        ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14)
      }
      ctx.stroke()
    }
    if (sweep !== null && sweep > 0 && sweep < W) {                                              // squeegee blade
      ctx.fillStyle = '#e9e1d2'; ctx.fillRect(sweep - 3, 0, 6, H); ctx.fillStyle = '#1f1b14'; ctx.fillRect(sweep + 3, 0, 2, H)
    }
    if (opt.cloth) {                                                                             // the cloth under the pointer
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.beginPath(); ctx.arc(opt.cloth.x, opt.cloth.y, CLOTH, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    }
  }
}

const ochre = () => getComputedStyle(document.documentElement).getPropertyValue('--dust').trim() || '#b67d2c'

function Readout({ refs }: { refs: { pct: React.RefObject<HTMLSpanElement | null>; inr: React.RefObject<HTMLSpanElement | null>; day: React.RefObject<HTMLSpanElement | null> } }) {
  return (
    <div className="dust-readout" aria-hidden="true">
      <div><span className="eyebrow">Since last wash</span><span className="reading md" ref={refs.day}>Day 1</span></div>
      <div><span className="eyebrow">Output vs sunshine</span><span className="reading md" ref={refs.pct}>100%</span></div>
      <div><span className="eyebrow">Lost per month</span><span className="reading md" ref={refs.inr}>₹0</span></div>
    </div>
  )
}

/** Static dusty-vs-clean pair for people who prefer reduced motion. */
function StaticPair() {
  const dusty = useRef<HTMLCanvasElement>(null), clean = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const draw = () => {
      if (dusty.current) new Renderer(dusty.current, ochre()).draw({ phase: 'build', ending: 'rain', day: DAYS, loss: MAX_LOSS, k: 1 }, 0)
      if (clean.current) new Renderer(clean.current, ochre()).draw({ phase: 'hold', ending: 'clean', day: 0, loss: 0, k: 0 }, 1300)
    }
    draw(); window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])
  return (
    <div className="dust-pair">
      <figure><canvas ref={dusty} role="img" aria-label={`Panels after ${DAYS} dry days: ${outputPct(MAX_LOSS)}% output, ₹${lostPerMonth(MAX_LOSS)} lost a month`} />
        <figcaption>Day {DAYS}: <b>{outputPct(MAX_LOSS)}%</b> output, <b>₹{lostPerMonth(MAX_LOSS)}</b> lost a month</figcaption></figure>
      <figure><canvas ref={clean} role="img" aria-label="Clean panels: 100% output, ₹0 lost" />
        <figcaption>Clean: <b>100%</b> output, <b>₹0</b> lost</figcaption></figure>
    </div>
  )
}

export default function DustPanel() {
  const still = reducedMotion()
  const canvas = useRef<HTMLCanvasElement>(null)
  const pct = useRef<HTMLSpanElement>(null), inr = useRef<HTMLSpanElement>(null), day = useRef<HTMLSpanElement>(null)
  const cap = useRef<HTMLParagraphElement>(null), live = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (still || !canvas.current) return
    const el = canvas.current, r = new Renderer(el, ochre())
    let t = 0, last = performance.now(), raf = 0, visible = false
    let wipe: { loss: number; covered: Set<number>; last: number } | null = null
    let cloth: { x: number; y: number } | null = null
    let lastPhase = ''

    const show = (s: Scene, wiped?: number) => {
      pct.current!.textContent = `${outputPct(s.loss)}%`
      inr.current!.textContent = `₹${lostPerMonth(s.loss)}`
      day.current!.textContent = s.phase === 'build' ? `Day ${dayLabel(s)}` : s.phase === 'end' ? `Day ${DAYS}` : 'Washed'
      const tone = s.loss > 0.01 ? 'is-dust' : 'is-clean'
      pct.current!.className = inr.current!.className = `reading md ${tone}`
      cap.current!.textContent = caption(s, wiped)
      const phase = wiped !== undefined ? 'wipe' : `${s.phase}-${s.ending}`
      // Announce only the outcome of each loop and wiping, not every dusty day.
      if (phase !== lastPhase) { lastPhase = phase; if (s.phase === 'hold' || phase === 'wipe') live.current!.textContent = wiped !== undefined ? 'Wiping the panels clean.' : caption(s) }
    }

    const frame = (now: number) => {
      const dt = Math.min(50, now - last); last = now
      if (wipe && now - wipe.last > IDLE_MS) { wipe = null; cloth = null; r.clearMask() }        // dust resettles, loop resumes
      if (!wipe) t += dt
      const base = sceneAt(t)
      if (wipe) {
        const f = wipe.covered.size / (GRID_X * GRID_Y)
        const s: Scene = { ...base, phase: 'build', loss: wipe.loss * (1 - f) }
        r.draw({ ...s, loss: wipe.loss }, now, { cloth, wiping: true }); show(s, f)
      } else { r.draw(base, now); show(base) }
      raf = visible ? requestAnimationFrame(frame) : 0
    }
    const start = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame) } }

    const toPanel = (e: PointerEvent) => { const b = el.getBoundingClientRect(); return { x: ((e.clientX - b.left) / b.width) * W, y: ((e.clientY - b.top) / b.height) * H } }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.buttons === 0 && e.type !== 'pointerdown') return
      const p = toPanel(e); cloth = p
      if (!wipe) {
        const cur = sceneAt(t).loss
        wipe = { loss: cur > MAX_LOSS / 2 ? cur : MAX_LOSS, covered: new Set(), last: 0 }       // nothing to wipe? the dust settles first
      }
      wipe.last = performance.now()
      r.wipe(p.x, p.y)
      const cx = (W / GRID_X), cy = (H / GRID_Y)
      for (let gx = Math.floor((p.x - CLOTH) / cx); gx <= Math.floor((p.x + CLOTH) / cx); gx++)
        for (let gy = Math.floor((p.y - CLOTH) / cy); gy <= Math.floor((p.y + CLOTH) / cy); gy++)
          if (gx >= 0 && gy >= 0 && gx < GRID_X && gy < GRID_Y && Math.hypot((gx + 0.5) * cx - p.x, (gy + 0.5) * cy - p.y) <= CLOTH) wipe.covered.add(gy * GRID_X + gx)
    }
    const onLeave = () => { cloth = null }
    el.addEventListener('pointermove', onMove); el.addEventListener('pointerdown', onMove); el.addEventListener('pointerleave', onLeave)

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start() }, { threshold: 0.05 })
    io.observe(el)
    const ro = new ResizeObserver(() => r.resize()); ro.observe(el)
    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect()
      el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerdown', onMove); el.removeEventListener('pointerleave', onLeave)
    }
  }, [still])

  if (still) return <figure className="dust-demo"><StaticPair /></figure>
  return (
    <figure className="dust-demo">
      <canvas ref={canvas} className="dust-canvas" role="img"
        aria-label={`Solar panels gathering dust over ${DAYS} dry days, then washed. Output falls to ${outputPct(MAX_LOSS)}% of what the sun allowed, about ₹${lostPerMonth(MAX_LOSS)} a month. Move a finger or the pointer over it to wipe it clean.`} />
      <Readout refs={{ pct, inr, day }} />
      <p className="dust-caption" ref={cap} aria-hidden="true">Freshly washed: the panels make what the sun allows.</p>
      <span className="sr-only" aria-live="polite" ref={live} />
      <p className="dust-hint muted small">Wipe the panel to clean it. Illustration of a 3 kWp roof in Ahmedabad, ₹6/unit.</p>
    </figure>
  )
}
