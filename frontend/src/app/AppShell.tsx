import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { auth } from '../lib/auth'
import { ArcLoader, Logo } from '../ui/arc'
import { Icon, type IconName } from '../ui/icons'

const NAV: { to: string; label: string; icon: IconName; tab?: boolean }[] = [
  { to: '/app', label: 'Overview', icon: 'home', tab: true },
  { to: '/app/check', label: 'New check', icon: 'camera', tab: true },
  { to: '/app/report', label: 'Report', icon: 'chart' },
  { to: '/app/money', label: 'Money', icon: 'rupee', tab: true },
  { to: '/app/clean', label: 'Get it cleaned', icon: 'droplet', tab: true },
  { to: '/app/history', label: 'History', icon: 'history' },
  { to: '/app/settings', label: 'My system', icon: 'settings', tab: true },
]

/** Protected area: redirects to /login when there is no Cognito session. */
export default function AppShell() {
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => { auth.currentEmail().then(setEmail) }, [])

  if (email === undefined) return <div className="center-screen"><ArcLoader label="Checking your session" /></div>
  if (email === null) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />

  return (
    <div className="app">
      <a className="skip" href="#app-main">Skip to content</a>
      <aside className="sidebar">
        <Link to="/app" aria-label="SuryaCheck overview"><Logo size={28} /></Link>
        <nav aria-label="App">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/app'}><Icon name={n.icon} />{n.label}</NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="muted small" title={email}>{email}</span>
          <button className="btn btn-ghost" onClick={() => auth.signOut().then(() => nav('/'))}><Icon name="logout" />Log out</button>
        </div>
      </aside>
      <main id="app-main" className="app-main"><Outlet /></main>
      <nav className="tabbar" aria-label="App">
        {NAV.filter((n) => n.tab).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/app'}><Icon name={n.icon} /><span>{n.label.split(' ')[0]}</span></NavLink>
        ))}
      </nav>
    </div>
  )
}
