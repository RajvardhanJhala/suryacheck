// Auto-advancing tabs with a progress line on each tab (after heycubit.github.io/effortless).
// The active tab's line fills over 7s, then the next tab opens. Hover or focus pauses it.
import { useState } from 'react'
import { reducedMotion } from '../ui/geometry'
import { Icon, type IconName } from '../ui/icons'

type Cause = { icon: IconName; tone: 'dust' | 'fault' | 'clean'; name: string; headline: string; looks: string; signature: string; yours: string; peers?: string }
// Sparklines on a 300x90 box: dashed = what the sun allowed, solid = your roof, thin = nearby roofs.
const EXPECTED = 'M0 30 L300 30'
const CAUSES: Cause[] = [
  { icon: 'dust', tone: 'dust', name: 'Dust', headline: 'Dust is a slow slide nobody notices.',
    looks: 'A slightly smaller number every day. Nothing looks wrong.',
    signature: 'A steady slide that starts after the last rain, while your neighbours stay level.',
    yours: 'M0 31 C60 34 120 42 180 50 S260 62 300 66', peers: 'M0 32 L300 33' },
  { icon: 'bolt', tone: 'fault', name: 'A fault', headline: 'A fault is a cliff, not a slope.',
    looks: 'One day the units drop and stay down. No alarm.',
    signature: 'A sudden step down that holds for days, not a slide.',
    yours: 'M0 31 L140 32 L146 70 L300 71', peers: 'M0 32 L300 33' },
  { icon: 'cloud', tone: 'clean', name: 'Weather', headline: 'A cloudy week is not your fault.',
    looks: 'A bad week. Nothing to fix.',
    signature: 'Everyone nearby dipped too, so SuryaCheck tells you to relax.',
    yours: 'M0 31 C80 31 110 64 150 64 S220 31 300 31', peers: 'M0 33 C80 33 110 66 150 66 S220 33 300 33' },
]

export default function CauseTabs() {
  const [i, setI] = useState(0)
  const c = CAUSES[i]
  return (
    <div className="cause-tabs">
      <div role="tablist" aria-label="What a loss looks like" className="cause-tablist">
        {CAUSES.map((t, k) => (
          <button key={t.name} role="tab" id={`cause-tab-${k}`} aria-selected={k === i} aria-controls="cause-panel"
            className={`cause-tab${k < i ? ' is-done' : ''}`} onClick={() => setI(k)}>
            <span className="cause-progress">
              {/* restarting key re-runs the fill; reduced motion would end instantly, so never auto-advance then */}
              {k === i && <span key={i} className="cause-fill" onAnimationEnd={() => !reducedMotion() && setI((i + 1) % CAUSES.length)} />}
            </span>
            <Icon name={t.icon} size={16} />{t.name}
          </button>
        ))}
      </div>
      <div id="cause-panel" role="tabpanel" aria-labelledby={`cause-tab-${i}`} className="cause-panel" key={c.name}>
        <h3>{c.headline}</h3>
        <div className="cause-body">
          <div>
            <p><span className="muted">What you see:</span> {c.looks}</p>
            <p><span className="muted">What SuryaCheck sees:</span> {c.signature}</p>
          </div>
          <figure className="cause-spark">
            <svg viewBox="0 0 300 90" aria-hidden="true">
              <path d={EXPECTED} className="spark-expected" />
              {c.peers && <path d={c.peers} className="spark-peers" />}
              <path d={c.yours} className={`spark-yours is-${c.tone}`} pathLength={1} />
            </svg>
            <figcaption className="small muted">
              <span className="key key-expected" />What the sun allowed <span className="key key-peers" />Nearby roofs <span className={`key is-${c.tone}`} />Your roof
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  )
}
