import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useSearchParams } from 'react-router'
import { api, type Analysis, type SiteView } from '../api'
import { Logo } from '../ui/arc'
import { Icon, type IconName } from '../ui/icons'
import { Badge } from '../ui/primitives'
import { mySite, SAMPLES, SiteCtx, type SiteState } from './siteContext'

const NAV: { to: string; label: string; icon: IconName; tab?: boolean }[] = [
  { to: '', label: 'Overview', icon: 'home', tab: true },
  { to: '/check', label: 'New check', icon: 'camera', tab: true },
  { to: '/report', label: 'Report', icon: 'chart', tab: true },
  { to: '/money', label: 'Money', icon: 'rupee', tab: true },
  { to: '/clean', label: 'Get it cleaned', icon: 'droplet' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/settings', label: 'My system', icon: 'settings', tab: true },
]

/** /app (this browser's own site) and /sample (public, seeded sample sites) share every screen. */
export default function AppShell({ mode }: { mode: 'app' | 'sample' }) {
  const sample = mode === 'sample'
  const base = sample ? '/sample' : '/app'
  const loc = useLocation()
  const [params, setParams] = useSearchParams()
  const [siteId, setSiteIdState] = useState<string | null>(sample ? (params.get('site') ?? SAMPLES[0].id) : mySite.get())
  const [view, setView] = useState<SiteView | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!siteId) { setLoading(false); return }
    setLoading(true); setError('')
    try {
      const v = await api.getSite(siteId)
      setView(v); setAnalysisId(v.latestAnalysisId)
      setAnalysis(v.latestAnalysisId ? await api.waitForAnalysis(siteId, v.latestAnalysisId) : null)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [siteId])

  useEffect(() => { reload() }, [reload])

  // First visit: set up the system before anything else.
  if (!sample && !siteId && !loading && !loc.pathname.endsWith('/settings')) return <Navigate to="/app/settings?welcome=1" replace />

  const setSiteId = (id: string) => { setSiteIdState(id); if (sample) setParams({ site: id }); else mySite.set(id) }
  const state: SiteState = { base, sample, siteId, view, analysis, analysisId, loading, error, reload, setSiteId }
  const q = sample ? `?site=${siteId}` : ''

  return (
    <SiteCtx.Provider value={state}>
      <div className="app">
        <a className="skip" href="#app-main">Skip to content</a>
        <aside className="sidebar">
          <Link to={sample ? '/' : '/app'} aria-label="SuryaCheck"><Logo size={28} /></Link>
          <nav aria-label="App">
            {NAV.map((n) => (
              <NavLink key={n.to} to={`${base}${n.to}${q}`} end={n.to === ''}><Icon name={n.icon} />{n.label}</NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            {sample && <Link className="btn btn-primary" to="/app">Check my own roof</Link>}
          </div>
        </aside>
        <div className="app-col">
          {sample && (
            <div className="sample-bar" role="region" aria-label="Sample data">
              <Badge tone="sun" icon="info">Sample data</Badge>
              <span className="muted small">Real Ahmedabad weather, simulated panels.</span>
              <label className="sr-only" htmlFor="sample-pick">Sample system</label>
              <select id="sample-pick" value={siteId ?? ''} onChange={(e) => setSiteId(e.target.value)}>
                {SAMPLES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Link to="/" className="sample-exit">Exit</Link>
            </div>
          )}
          <main id="app-main" className="app-main"><Outlet /></main>
        </div>
        <nav className="tabbar" aria-label="App">
          {NAV.filter((n) => n.tab).map((n) => (
            <NavLink key={n.to} to={`${base}${n.to}${q}`} end={n.to === ''}><Icon name={n.icon} /><span>{n.label.split(' ')[0]}</span></NavLink>
          ))}
        </nav>
      </div>
    </SiteCtx.Provider>
  )
}
