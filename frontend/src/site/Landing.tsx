import { Link } from 'react-router'
import { usePageMeta } from '../lib/seo'
import { ArcDivider } from '../ui/arc'
import { Icon, type IconName } from '../ui/icons'
import { Badge } from '../ui/primitives'
import DustDemo from './DustDemo'

const CAUSES: { icon: IconName; tone: 'dust' | 'fault' | 'neutral'; name: string; looks: string; signature: string }[] = [
  { icon: 'dust', tone: 'dust', name: 'Dust', looks: 'A slightly smaller number every day. Nothing looks wrong.',
    signature: 'A slow slide that starts after the last rain, while your neighbours stay level.' },
  { icon: 'bolt', tone: 'fault', name: 'A string or inverter fault', looks: 'One day the units drop and stay down. No alarm.',
    signature: 'A sudden step down that holds for days, not a slide.' },
  { icon: 'cloud', tone: 'neutral', name: 'Weather', looks: 'A bad week. Nothing to fix.',
    signature: 'Everyone nearby dipped too — SuryaCheck tells you to relax.' },
]

const STEPS = [
  { icon: 'camera' as IconName, title: 'Photograph your inverter', text: 'The daily units on its display or app. We read them; you confirm.' },
  { icon: 'sun' as IconName, title: 'We fetch your sunshine', text: 'Hourly sunlight and temperature for your exact roof, for every day.' },
  { icon: 'chart' as IconName, title: 'Compare with physics and neighbours', text: 'What your panels should have made, and how nearby roofs did.' },
  { icon: 'rupee' as IconName, title: 'Rupees, cause, one action', text: 'Then we recheck after you act, against the same yardstick.' },
]

export default function Landing() {
  usePageMeta('SuryaCheck', 'Find the money your rooftop solar is losing to dust and faults — measured against the real sunshine on your roof.')
  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <p className="eyebrow">For rooftop solar owners in India</p>
          <h1>Your panels may be losing ₹300 a month. <em>You'd never see it.</em></h1>
          <p className="lead">SuryaCheck compares what your rooftop solar made with what the real sunshine on your roof allowed —
            then tells you why, what it costs, and the one thing to do.</p>
          <div className="row">
            <Link className="btn btn-primary" to="/signup"><Icon name="camera" size={18} />Check my roof</Link>
            <Link className="btn btn-secondary" to="/sample"><Icon name="chart" size={18} />Try a sample system</Link>
          </div>
        </div>
        <DustDemo />
      </section>

      <div className="wrap"><ArcDivider /></div>

      <section className="wrap section">
        <p className="eyebrow">Why it goes unnoticed</p>
        <h2>Your inverter shows a number. It never says it's too small.</h2>
        <div className="causes">
          {CAUSES.map((c) => (
            <article key={c.name} className="cause">
              <Badge tone={c.tone} icon={c.icon}>{c.name}</Badge>
              <p><span className="muted">What you see:</span> {c.looks}</p>
              <p><span className="muted">What SuryaCheck sees:</span> {c.signature}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="wrap section">
        <p className="eyebrow">How it works</p>
        <h2>From one photo to the rupees, in about a minute</h2>
        <ol className="sunpath-steps">
          <svg className="sunpath-line" viewBox="0 0 1000 140" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 0 114 A 500 90 0 0 1 1000 114" fill="none" stroke="var(--line)" strokeWidth="2" strokeDasharray="6 8" vectorEffect="non-scaling-stroke" />
          </svg>
          {STEPS.map((s, i) => {
            // Drop each step so its 48px dot sits on the arc above: same ellipse as the path (rx 500, ry 90).
            const dx = ((i + 0.5) / STEPS.length - 0.5) * 2
            const dy = Math.round(90 * (1 - Math.sqrt(1 - dx * dx)))
            return (
              <li key={s.title} style={{ '--dy': `${dy}px` } as React.CSSProperties}>
                <span className="step-dot"><Icon name={s.icon} size={22} /></span>
                <strong>{s.title}</strong>
                <span className="muted">{s.text}</span>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="wrap section trust">
        <div>
          <p className="eyebrow">Why you can trust the number</p>
          <h2>Code computes every rupee. The AI only explains.</h2>
          <p>Expected output comes from the open-source <strong>pvlib</strong> solar model fed with real hourly weather from
            <strong> Open-Meteo</strong>. The diagnosis follows fixed, published rules. Nothing is guessed by a language model.</p>
          <Link to="/how-it-works">Read the full method and its limits <Icon name="arrowRight" size={16} /></Link>
        </div>
        <dl className="trust-facts">
          <div><dt>Clean roofs read healthy</dt><dd className="reading md is-clean">99<small>%</small></dd></div>
          <div><dt>Dusty roofs caught</dt><dd className="reading md is-dust">300<small>/300</small></dd></div>
          <div><dt>String faults caught</dt><dd className="reading md">300<small>/300</small></dd></div>
          <p className="muted small">Rule test on 300 simulated roofs with 3% daily noise. Real-world accuracy is still to be measured.</p>
        </dl>
      </section>

      <section className="wrap section cta-band">
        <ArcDivider />
        <h2>Find out what your roof is losing.</h2>
        <p className="lead">Free. You need the daily units from your inverter and your roof's location.</p>
        <div className="row center">
          <Link className="btn btn-primary" to="/signup">Check my roof</Link>
          <Link className="btn btn-secondary" to="/sample">Try a sample system</Link>
        </div>
      </section>
    </>
  )
}
