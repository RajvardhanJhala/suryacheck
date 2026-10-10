import { Link } from 'react-router'
import { usePageMeta } from '../lib/seo'
import { arcPath } from '../ui/geometry'

/** The sun has set below the horizon: nothing here. Also used as the empty-state art. */
export function SetSun({ size = 220 }: { size?: number }) {
  return (
    <svg className="set-sun" width={size} height={size * 0.55} viewBox="0 0 200 110" aria-hidden="true">
      <path d={arcPath(100, 90, 70)} fill="none" stroke="var(--line)" strokeWidth="3" strokeDasharray="4 7" strokeLinecap="round" />
      <clipPath id="below"><rect x="0" y="0" width="200" height="90" /></clipPath>
      <circle className="set-sun-disc" cx="176" cy="96" r="14" fill="var(--sun)" clipPath="url(#below)" />
      <line x1="10" y1="90" x2="190" y2="90" stroke="var(--ink-2)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export default function NotFound() {
  usePageMeta('Page not found')
  return (
    <section className="wrap not-found">
      <SetSun />
      <p className="eyebrow">404</p>
      <h1>The sun has set on this page.</h1>
      <p className="lead">It may have moved, or the link is wrong.</p>
      <Link className="btn btn-primary" to="/">Back to SuryaCheck</Link>
    </section>
  )
}
