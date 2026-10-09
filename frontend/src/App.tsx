import { useEffect, useState } from 'react'
import Home from './pages/Home'
import Setup from './pages/Setup'
import AddData from './pages/AddData'
import Report from './pages/Report'

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => { setHash(window.location.hash); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export const go = (path: string) => { window.location.hash = '/' + path }

export default function App() {
  const [page, id, sub] = useHashRoute()
  let view
  if (page === 'new') view = <Setup />
  else if (page === 'site' && id && sub === 'add') view = <AddData siteId={id} />
  else if (page === 'site' && id) view = <Report siteId={id} />
  else view = <Home />
  return (
    <div className="shell">
      <header className="topbar">
        <a href="#/" className="brand"><span className="sun" aria-hidden>☀</span> SuryaCheck</a>
      </header>
      <main>{view}</main>
      <footer className="foot">
        Weather: <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0) ·
        Physics: pvlib · Runs on AWS
      </footer>
    </div>
  )
}
