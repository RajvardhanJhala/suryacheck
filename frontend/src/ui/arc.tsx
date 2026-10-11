// The sun-path arc: sunrise (left) -> noon (top) -> sunset (right). One geometry, reused
// for the logo, the performance gauge, the loader, section dividers and the 404 page.
import { useEffect, useState } from 'react'
import { sunFraction } from '../lib/sun'
import { arcPath, arcPoint, reducedMotion } from './geometry'

/** Logo mark: the sun's path as a gauge, the sun as its needle tip (same geometry as scripts/make_icons.py). */
export function LogoMark({ size = 32, sun: t = 0.68 }: { size?: number; sun?: number }) {
  const sun = arcPoint(16, 23, 11, t)
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d={arcPath(16, 23, 11)} fill="none" stroke="var(--line)" strokeWidth="2.6" strokeLinecap="round" />
      <path d={`M 5 23 A 11 11 0 0 1 ${sun.x} ${sun.y}`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <line x1="2.5" y1="23" x2="29.5" y2="23" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={sun.x} cy={sun.y} r="3.9" fill="var(--sun)" stroke="var(--surface)" strokeWidth="1.4" />
    </svg>
  )
}

/** The sun's real position over Ahmedabad: sweeps from sunrise to now on load (ease-out, along the arc), then follows the clock. */
function useLiveSun(live: boolean) {
  const [t, setT] = useState(live && !reducedMotion() ? 0 : live ? sunFraction() : 0.68)
  useEffect(() => {
    if (!live) return
    let raf = 0
    const target = sunFraction(), t0 = performance.now()
    if (!reducedMotion()) {
      const step = (now: number) => { const k = Math.min(1, (now - t0) / 600); setT(target * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step) }
      raf = requestAnimationFrame(step)
    }
    const id = setInterval(() => setT(sunFraction()), 60000)
    return () => { cancelAnimationFrame(raf); clearInterval(id) }
  }, [live])
  return t
}

export function Logo({ size = 28, live = false }: { size?: number; live?: boolean }) {
  const t = useLiveSun(live)
  return (
    <span className="logo" style={{ fontSize: size * 0.72 }}>
      <LogoMark size={size} sun={t} />
      <span>Surya<b>Check</b></span>
    </span>
  )
}

/** Performance-ratio gauge. `value` is 0..1.1 of normal; colour follows meaning, text says it too. */
export function ArcGauge({ value, label, size = 260 }: { value: number; label?: string | null; size?: number }) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0)
  useEffect(() => { const id = requestAnimationFrame(() => setShown(value)); return () => cancelAnimationFrame(id) }, [value])
  const t = Math.max(0, Math.min(1, shown))
  const healthy = value >= 0.92
  const tone = healthy ? 'var(--clean)' : 'var(--dust)'
  const sun = arcPoint(100, 100, 82, t)
  return (
    <figure className="gauge" style={{ width: size }}>
      <svg viewBox="0 0 200 116" role="img" aria-label={`${Math.round(value * 100)}% of normal output${label ? `, ${label}` : ''}`}>
        <path d={arcPath(100, 100, 82)} fill="none" stroke="var(--sunken)" strokeWidth="12" strokeLinecap="round" />
        {Array.from({ length: 11 }, (_, i) => {
          const a = arcPoint(100, 100, 66, i / 10), b = arcPoint(100, 100, i % 5 === 0 ? 58 : 62, i / 10)
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--line)" strokeWidth="1.5" />
        })}
        <path d={arcPath(100, 100, 82)} fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round"
          pathLength={100} strokeDasharray="100" strokeDashoffset={100 - t * 100}
          style={{ transition: 'stroke-dashoffset 1.2s var(--ease)' }} />
        <circle cx={sun.x} cy={sun.y} r="8" fill="var(--sun)" stroke="var(--surface)" strokeWidth="3"
          style={{ transition: 'cx 1.2s var(--ease), cy 1.2s var(--ease)' }} />
        <line x1="6" y1="100" x2="194" y2="100" stroke="var(--line)" strokeWidth="1.5" />
      </svg>
      <figcaption>
        <span className="reading xl">{Math.round(value * 100)}<small>%</small></span>
        {label !== null && <span className={`gauge-label ${healthy ? 'is-clean' : 'is-dust'}`}>{label ?? (healthy ? 'Healthy' : 'Below normal')}</span>}
      </figcaption>
    </figure>
  )
}

/** Loader: the sun travels along its path. Static under reduced motion. */
export function ArcLoader({ label = 'Loading', size = 56 }: { label?: string; size?: number }) {
  const still = reducedMotion()
  return (
    <span className="arc-loader" role="status" aria-live="polite">
      <svg width={size} height={size * 0.6} viewBox="0 0 60 36" aria-hidden="true">
        <path d={arcPath(30, 32, 24)} fill="none" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
        <circle r="5" fill="var(--sun)" cx={still ? 30 : 0} cy={still ? 8 : 0}>
          {!still && <animateMotion dur="1.6s" repeatCount="indefinite" path={arcPath(30, 32, 24)}
            keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .55 1" />}
        </circle>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** Section divider: a faint horizon with a low sun arc. */
export function ArcDivider() {
  return (
    <svg className="arc-divider" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="22" x2="400" y2="22" stroke="var(--line)" strokeWidth="1" />
      <path d="M 170 22 A 30 18 0 0 1 230 22" fill="none" stroke="var(--line)" strokeWidth="1.5" />
      <circle cx="214" cy="9" r="3" fill="var(--sun)" />
    </svg>
  )
}
