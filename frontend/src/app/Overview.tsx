import { Link } from 'react-router'
import { usePageMeta } from '../lib/seo'
import { confidence, VERDICT } from '../lib/i18n'
import { bestInterval, inputsFromAnalysis } from '../lib/money'
import { ArcGauge } from '../ui/arc'
import { shortDate } from '../ui/charts'
import { Icon } from '../ui/icons'
import { Badge, Card, Reading } from '../ui/primitives'
import { useSite } from './siteContext'
import { Screen } from './States'

export default function Overview() {
  usePageMeta('Overview')
  const { analysis: a, view, base, sample } = useSite()
  return (
    <Screen title="Overview">
      {a && view && (() => {
        const v = VERDICT[a.verdict] ?? VERDICT.UNEXPLAINED
        const conf = confidence(a)
        const pr = a.performance.med3_latest ?? 0
        const cleaned = view.events.filter((e) => e.type === 'CLEANED').map((e) => e.date).sort().at(-1)
        const inp = inputsFromAnalysis(a, view.site.tariff_inr, view.site.cleaning_cost_inr)
        const n = a.verdict === 'SOILING' || a.verdict === 'STEADY_LOSS' ? bestInterval(inp) : null
        const from = cleaned && cleaned > a.performance.segment_start ? cleaned : a.performance.segment_start
        const next = n ? new Date(new Date(from + 'T00:00:00').getTime() + n * 86400000).toISOString().slice(0, 10) : null
        const overdue = next != null && next <= a.as_of
        return (
          <div className="overview">
            <header className="screen-head">
              <div>
                <p className="eyebrow">{view.site.label ?? 'My roof'} · {view.site.capacity_kwp} kWp · as of {shortDate(a.as_of)}</p>
                <h1>Overview</h1>
              </div>
              {!sample && <Link className="btn btn-primary" to={`${base}/check`}><Icon name="camera" size={18} />New check</Link>}
            </header>

            <div className="overview-grid">
              <Card className="ov-gauge">
                <p className="eyebrow">Performance · % of your normal</p>
                <ArcGauge value={pr} label={v.en} />
                <p className="muted small center">Last 3 clear days vs your best week in 90 days.</p>
              </Card>

              <Card className="ov-money">
                <p className="eyebrow">Lost this month (run-rate)</p>
                <Reading value={a.monthly_loss_inr} prefix="₹" size="xl" tone={a.monthly_loss_inr > 0 ? 'dust' : 'clean'} />
                <p className="muted small">If nothing changes. <Link to={`${base}/money${sample ? `?site=${view.siteId}` : ''}`}>See projections</Link></p>
              </Card>

              <Card className="ov-diagnosis">
                <p className="eyebrow">Latest diagnosis</p>
                <div className="row">
                  <Badge tone={v.tone} icon={v.tone === 'clean' ? 'check' : v.tone === 'fault' ? 'bolt' : v.tone === 'dust' ? 'dust' : 'info'}>{v.en}</Badge>
                  {conf && <Badge>{conf} confidence</Badge>}
                </div>
                <h2 className="h3">{a.explanation.headline}</h2>
                <p className="muted">{a.explanation.why}</p>
                <Link to={`${base}/report${sample ? `?site=${view.siteId}` : ''}`}>Open the full report <Icon name="arrowRight" size={16} /></Link>
              </Card>

              <Card className="ov-clean">
                <dl className="facts">
                  <div><dt><Icon name="droplet" size={18} /> Last cleaned</dt>
                    <dd className="reading md">{cleaned ? shortDate(cleaned) : '—'}</dd></div>
                  <div><dt><Icon name="calendar" size={18} /> Next recommended cleaning</dt>
                    <dd className={`reading md ${overdue ? 'is-dust' : ''}`}>{next ? (overdue ? 'Now' : shortDate(next)) : 'Not needed'}</dd></div>
                </dl>
                <p className="muted small">{n ? `Every ${n} days in the dry season balances cleaning cost against dust loss.` : 'No dust build-up measured.'}</p>
              </Card>
            </div>
          </div>
        )
      })()}
    </Screen>
  )
}
