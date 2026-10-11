import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams, useSearchParams } from 'react-router'
import { api, type Analysis, type SiteView } from '../api'
import { Logo } from '../ui/arc'
import { Icon, type IconName } from '../ui/icons'
import { mySite, SiteCtx, type SiteState } from './siteContext'

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/test', label: 'Test', icon: 'camera' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

/** Layout for /test, /r/:id, /history, /settings. The site comes from the route (/r/:id, ?sample=)
 *  or, by default, this browser's own site (no accounts). */
export default function AppShell() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const sampleId = params.get('sample')
  const [own, setOwn] = useState<string | null>(mySite.get())
  const siteId = id ?? sampleId ?? own
  const [view, setView] = useState<SiteView | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!siteId)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!siteId) { setView(null); setAnalysis(null); setAnalysisId(null); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const v = await api.getSite(siteId)
      setView(v); setAnalysisId(v.latestAnalysisId)
      setAnalysis(v.latestAnalysisId ? await api.waitForAnalysis(siteId, v.latestAnalysisId) : null)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [siteId])

  useEffect(() => { reload() }, [reload])

  const setSiteId = (sid: string) => { mySite.set(sid); setOwn(sid) }
  const sample = !!sampleId || !!view?.site.simulated
  const state: SiteState = { base: '/test', sample, siteId, view, analysis, analysisId, loading, error, reload, setSiteId }

  return (
    <SiteCtx.Provider value={state}>
      <div className="app">
        <a className="skip" href="#app-main">Skip to content</a>
        <header className="topbar no-print">
          <Link to="/" aria-label="SuryaCheck home"><Logo size={26} /></Link>
          <nav aria-label="App" className="topnav">
            {NAV.map((n) => <NavLink key={n.to} to={n.to}><Icon name={n.icon} size={18} />{n.label}</NavLink>)}
          </nav>
        </header>
        <main id="app-main" className="app-main"><Outlet /></main>
        <nav className="tabbar no-print" aria-label="App">
          {NAV.map((n) => <NavLink key={n.to} to={n.to}><Icon name={n.icon} /><span>{n.label}</span></NavLink>)}
        </nav>
      </div>
    </SiteCtx.Provider>
  )
}
