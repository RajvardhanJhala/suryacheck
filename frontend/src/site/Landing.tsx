import { Link } from 'react-router'
import { usePageMeta } from '../lib/seo'
import { ArcDivider } from '../ui/arc'
import { Icon, type IconName } from '../ui/icons'
import CauseTabs from './CauseTabs'
import DustPanel from './DustPanel'
import RoofCalc from './RoofCalc'
import { Reading } from '../ui/primitives'

// Stacked status cards (after heycubit.github.io/effortless). Examples of SuryaCheck's own messages.
const SIGNALS: { icon: IconName; tone: 'dust' | 'fault' | 'clean' | 'sun'; title: string; text: string; ring?: number; action: string }[] = [
  { icon: 'dust', tone: 'dust', title: 'Dust is building', text: '9% below what the sun allowed', ring: 91, action: 'Clean this week' },
  { icon: 'rupee', tone: 'sun', title: '₹212 lost this month', text: '₹2,540 a year if left', action: 'See the maths' },
  { icon: 'bolt', tone: 'fault', title: 'Sudden step down', text: '−31% since 4 Oct, neighbours normal', ring: 69, action: 'Call installer' },
  { icon: 'droplet', tone: 'clean', title: 'Rain washed it', text: 'Back to 98% of expected', ring: 98, action: 'Recheck done' },
]

// Deterministic star field for the night band (after rivermark.ai).
const STARS = Array.from({ length: 70 }, (_, i) => ({ x: (i * 61.8) % 100, y: (i * 38.2 * 1.7) % 100, r: i % 7 === 0 ? 1.6 : 0.9, tw: i % 5 === 0 }))

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
            <Link className="btn btn-primary" to="/test"><Icon name="camera" size={18} />Test your roof</Link>
            <Link className="btn btn-secondary btn-orb" to="/test?sample=demohemant01"><span className="orb"><Icon name="chart" size={16} /></span>Try a sample roof</Link>
          </div>
        </div>
        <DustPanel />
      </section>

      <div className="wrap"><ArcDivider /></div>

      <section className="wrap section signals">
        <div>
          <p className="eyebrow">What it tells you</p>
          <h2>One line. <span className="h-soft">The cause, the rupees, the next step.</span></h2>
          <p className="muted">Example messages. Yours come from your own readings.</p>
        </div>
        <ul className="signal-stack">
          {SIGNALS.map((s, k) => (
            <li key={s.title} className={`signal is-${s.tone}`} style={{ '--k': k } as React.CSSProperties}>
              <Icon name={s.icon} size={18} />
              <strong>{s.title}</strong>
              <span className="muted">{s.text}</span>
              {s.ring !== undefined && (
                <svg className="signal-ring" viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="10" cy="10" r="7.5" pathLength={100} />
                  <circle cx="10" cy="10" r="7.5" pathLength={100} strokeDasharray={`${s.ring} 100`} />
                </svg>
              )}
              <span className="signal-chip">{s.action}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap section">
        <p className="eyebrow">Why it goes unnoticed</p>
        <h2>Your inverter shows a number. <span className="h-soft">It never says it's too small.</span></h2>
        <CauseTabs />
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

      <section className="wrap section calc-section">
        <p className="eyebrow">Your roof</p>
        <h2>What dust costs a roof like yours <span className="h-soft">before you test it.</span></h2>
        <RoofCalc />
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
          <div><dt>Clean roofs read healthy</dt><dd><Reading value={99} unit="%" size="md" tone="clean" /></dd></div>
          <div><dt>Dusty roofs caught</dt><dd><Reading value={300} unit="/300" size="md" tone="dust" /></dd></div>
          <div><dt>String faults caught</dt><dd><Reading value={300} unit="/300" size="md" /></dd></div>
        </dl>
        <p className="muted small trust-note">Rule test on 300 simulated roofs with 3% daily noise. Real-world accuracy is still to be measured.</p>
      </section>

      <section className="night">
        <svg className="night-stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {STARS.map((s, k) => <circle key={k} cx={s.x} cy={s.y} r={s.r / 10} className={s.tw ? 'tw' : undefined} style={{ '--k': k % 4 } as React.CSSProperties} />)}
        </svg>
        <div className="wrap night-inner">
          <h2>The sun sets every evening. <em>Your losses</em> don't.</h2>
          <p className="lead">Dust settles on most roofs in Indian cities between rains. On a 3 kW system that can quietly cost a few hundred
            rupees a month. Nobody tells you, because the inverter only shows today's number.</p>
          <p className="lead">Free. You need the daily units from your inverter and your roof's location.</p>
          <div className="row">
            <Link className="btn btn-primary" to="/test">Test your roof</Link>
            <Link className="btn btn-secondary btn-orb" to="/test?sample=demohemant01"><span className="orb"><Icon name="chart" size={16} /></span>Try a sample roof</Link>
          </div>
        </div>
      </section>
    </>
  )
}
