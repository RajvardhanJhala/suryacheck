import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api, type AnalysisSummary } from '../api'
import { VERDICT } from '../lib/i18n'
import { usePageMeta } from '../lib/seo'
import { ArcLoader } from '../ui/arc'
import { shortDate } from '../ui/charts'
import { Icon } from '../ui/icons'
import { Badge, Notice } from '../ui/primitives'
import { useSite } from './siteContext'

type Item = { date: string; kind: 'test'; a: AnalysisSummary } | { date: string; kind: 'cleaned' }

/** Past tests and cleanings, newest first, so before/after a cleaning reads top to bottom. */
export default function History() {
  usePageMeta('History')
  const { siteId, view, loading } = useSite()
  const [items, setItems] = useState<Item[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!siteId || !view) return
    api.listAnalyses(siteId).then(({ analyses }) => {
      const tests: Item[] = analyses.filter((a) => a.status === 'DONE' && a.as_of).map((a) => ({ date: a.as_of!, kind: 'test', a }))
      const cleaned: Item[] = view.events.filter((e) => e.type === 'CLEANED').map((e) => ({ date: e.date, kind: 'cleaned' }))
      setItems([...tests, ...cleaned].sort((x, y) => y.date.localeCompare(x.date)))
    }).catch((e) => setErr((e as Error).message))
  }, [siteId, view])

  if (loading || (siteId && !items && !err)) return <div className="center-screen"><ArcLoader label="Loading history" /></div>
  return (
    <div className="history">
      <h1>History</h1>
      {err && <Notice tone="fault" title={err} />}
      {!siteId || items?.length === 0 ? (
        <div className="state"><p className="muted">No tests yet.</p><Link className="btn btn-primary" to="/test">Test your roof</Link></div>
      ) : (
        <ol className="timeline-list">
          {items?.map((it, i) => it.kind === 'cleaned' ? (
            <li key={`c${i}`} className="hist is-clean"><Icon name="droplet" size={18} /><span>Cleaned</span><time className="muted small">{shortDate(it.date)}</time></li>
          ) : (
            <li key={it.a.analysisId} className="hist">
              <Badge tone={VERDICT[it.a.verdict ?? '']?.tone ?? 'neutral'}>{VERDICT[it.a.verdict ?? '']?.en ?? it.a.verdict}</Badge>
              <span>{(it.a.monthly_loss_inr ?? 0) > 0 ? `₹${it.a.monthly_loss_inr} a month lost` : 'No loss'}</span>
              <time className="muted small">{shortDate(it.date)}</time>
              {i === 0 && <Link to="/test">Latest result</Link>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
