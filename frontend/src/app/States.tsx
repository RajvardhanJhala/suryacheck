import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { SetSun } from '../site/NotFound'
import { ArcLoader } from '../ui/arc'
import { Button, Notice } from '../ui/primitives'
import { useSite } from './siteContext'

/** Wraps every app screen: loading / error / no-analysis-yet states, then the screen. */
export function Screen({ title, needsAnalysis = true, children }: { title: string; needsAnalysis?: boolean; children: ReactNode }) {
  const { loading, error, analysis, reload, sample } = useSite()
  if (loading) return <div className="center-screen"><ArcLoader label={`Loading ${title}`} /></div>
  if (error) return (
    <div className="state">
      <Notice tone="fault" title="Couldn't load your data">{error}</Notice>
      <Button variant="secondary" icon="history" onClick={reload}>Try again</Button>
    </div>
  )
  if (needsAnalysis && !analysis) return (
    <section className="empty">
      <SetSun size={180} />
      <h1>{title}</h1>
      <p className="muted">{sample ? 'This sample has no check yet.' : 'No check yet. Add a few days of your inverter readings to get your first report.'}</p>
      {!sample && <Link className="btn btn-primary" to="/test">Start a new check</Link>}
    </section>
  )
  if (needsAnalysis && analysis?.status === 'FAILED') return (
    <div className="state"><Notice tone="fault" title="The last check failed">{analysis.error}</Notice>
      {!sample && <Link className="btn btn-primary" to="/test">Run a new check</Link>}</div>
  )
  return <>{children}</>
}
