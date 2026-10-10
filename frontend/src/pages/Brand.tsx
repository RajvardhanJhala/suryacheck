import './brand.css'
import { ArcDivider, ArcGauge, ArcLoader, Logo, LogoMark } from '../ui/arc'
import { Icon, type IconName } from '../ui/icons'
import { Badge, Button, Card, Field, Notice, Reading } from '../ui/primitives'

const SWATCHES: [string, string, string][] = [
  ['--paper', 'Paper', 'Page background'], ['--surface', 'Surface', 'Cards'], ['--ink', 'Ink', 'Text'],
  ['--sun', 'Sun', 'Primary action · energy'], ['--dust', 'Dust', 'Soiling · money lost — only'],
  ['--clean', 'Clean panel', 'Healthy · recovered — only'], ['--fault', 'Fault', 'Electrical fault · errors — only'],
]
const ICONS: IconName[] = ['sun', 'arc', 'panel', 'meter', 'inverter', 'camera', 'upload', 'rupee', 'dust', 'droplet', 'wrench',
  'bolt', 'cloud', 'shade', 'check', 'alert', 'phone', 'chat', 'mail', 'pin', 'home', 'history', 'settings', 'chart', 'calendar', 'globe']

export default function Brand() {
  return (
    <div className="brand-page">
      <header className="brand-head">
        <Logo size={40} />
        <p className="eyebrow">Brand system · the solar instrument</p>
      </header>

      <section className="brand-hero">
        <div>
          <p className="eyebrow">Hemant's roof · Chandkheda</p>
          <h1>Dust is quietly costing you <span className="nowrap">money.</span></h1>
          <p className="lead">Your panels made <strong>86%</strong> of what this week's sunshine allowed.
            Your neighbours made 97%.</p>
          <div className="row">
            <Button icon="camera">Start a new check</Button>
            <Button variant="secondary" icon="chart">See the evidence</Button>
          </div>
        </div>
        <Card className="money-card">
          <ArcGauge value={0.86} label="Soiling" />
          <div className="money-row">
            <div><p className="eyebrow">Lost this month</p><Reading value={366} prefix="₹" tone="dust" /></div>
            <div><p className="eyebrow">Next 12 months</p><Reading value={5280} prefix="₹" size="md" tone="dust" /></div>
          </div>
          <Badge tone="dust" icon="dust">Soiling · high confidence</Badge>
        </Card>
      </section>

      <ArcDivider />

      <h2>Colour carries one meaning each</h2>
      <div className="swatches">
        {SWATCHES.map(([v, name, use]) => (
          <div key={v} className="swatch">
            <span style={{ background: `var(${v})` }} />
            <strong>{name}</strong><span className="muted">{use}</span>
          </div>
        ))}
      </div>

      <ArcDivider />

      <div className="two-col">
        <div>
          <h2>Type</h2>
          <p className="eyebrow">Display · Fraunces</p>
          <h1 style={{ margin: 0 }}>What the sun allowed</h1>
          <p className="eyebrow" style={{ marginTop: 'var(--s-5)' }}>Text · Noto Sans (+ Devanagari)</p>
          <p>Expected units come from real hourly sunshine for your roof. आपके पैनल पर धूल जमी है।</p>
          <p className="eyebrow">Readings · IBM Plex Mono, tabular</p>
          <div className="row">
            <Reading value={12.4} decimals={1} unit="kWh" size="md" />
            <Reading value={2.95} decimals={2} unit="kWp" size="md" />
            <Reading value={97} unit="%" size="md" tone="clean" />
          </div>
        </div>
        <div>
          <h2>The sun-path arc</h2>
          <div className="row">
            <ArcGauge value={0.97} size={200} />
            <div style={{ display: 'grid', gap: 'var(--s-4)', justifyItems: 'center' }}>
              <LogoMark size={64} />
              <ArcLoader label="Fetching sunlight" />
            </div>
          </div>
        </div>
      </div>

      <ArcDivider />

      <div className="two-col">
        <div>
          <h2>Components</h2>
          <div className="row wrap">
            <Button icon="plus">Primary</Button>
            <Button variant="secondary" icon="phone">Secondary</Button>
            <Button variant="ghost" icon="arrowRight">Ghost</Button>
          </div>
          <div className="row wrap" style={{ marginTop: 'var(--s-4)' }}>
            <Badge tone="sun">Sample data</Badge><Badge tone="dust" icon="dust">Soiling</Badge>
            <Badge tone="clean" icon="check">Recovered</Badge><Badge tone="fault" icon="bolt">Fault</Badge>
            <Badge>Estimate</Badge>
          </div>
          <div style={{ display: 'grid', gap: 'var(--s-3)', marginTop: 'var(--s-5)' }}>
            <Notice tone="clean" title="Cleaning worked">Output is back to 100% of normal — ₹255/month recovered.</Notice>
            <Notice tone="fault" title="Upload failed">The photo is over 3.75 MB. Try again.</Notice>
          </div>
        </div>
        <Card>
          <Field id="kwp" label="System size (kWp)" defaultValue="3.0" inputMode="decimal" hint="On the inverter sticker." />
          <Field id="tariff" label="Tariff (₹ per unit)" defaultValue="abc" error="Enter a number, e.g. 6.5" />
          <div className="icon-grid">
            {ICONS.map((n) => <span key={n} title={n}><Icon name={n} size={24} /></span>)}
          </div>
        </Card>
      </div>
    </div>
  )
}
