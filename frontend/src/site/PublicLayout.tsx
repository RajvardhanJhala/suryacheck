import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { Logo } from '../ui/arc'
import { Icon } from '../ui/icons'

export default function PublicLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="site">
      <a className="skip" href="#main">Skip to content</a>
      <p className="announce"><span className="announce-tag">New</span> Read your inverter or meter with your phone camera.{' '}
        <Link to="/signup">Try it <Icon name="arrowRight" size={14} /></Link></p>
      <header className="site-nav">
        <Link to="/" aria-label="SuryaCheck home"><Logo size={30} /></Link>
        <button className="btn btn-ghost nav-toggle" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(!open)}>
          <Icon name={open ? 'close' : 'menu'} label={open ? 'Close menu' : 'Open menu'} />
        </button>
        <nav id="site-menu" className={open ? 'is-open' : ''} onClick={() => setOpen(false)}>
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/sample">Sample system</NavLink>
          <Link className="btn btn-primary" to="/signup">Check my roof</Link>
        </nav>
      </header>
      <main id="main"><Outlet /></main>
      <footer className="site-foot">
        <Logo size={24} />
        <p className="muted">Built for Environmental Hacks 2026 (AWS × WeMakeDevs). Weather data:{' '}
          <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0). Solar model:{' '}
          <a href="https://pvlib-python.readthedocs.io" target="_blank" rel="noreferrer">pvlib</a>. Runs on AWS.</p>
        <nav className="foot-links"><Link to="/how-it-works">Methodology</Link><Link to="/sample">Sample system</Link></nav>
      </footer>
    </div>
  )
}
