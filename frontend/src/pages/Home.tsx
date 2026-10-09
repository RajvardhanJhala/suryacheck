import { go } from '../App'

const DEMOS = [
  { id: 'demohemant01', name: 'Hemant · Chandkheda', blurb: '3 kW roof next to a construction site. Output sliding since the last rain.' },
  { id: 'demomeera001', name: 'Meera · Chandkheda', blurb: 'Same street, same sunshine — but her output dropped overnight.' },
  { id: 'demoreplay01', name: "Hemant's roof · after cleaning", blurb: 'Replay: what happened after he got the panels cleaned.' },
]

export default function Home() {
  const mine = (() => { try { return localStorage.getItem('suryacheck.site') } catch { return null } })()
  return (
    <>
      <section className="hero">
        <h1>Is your rooftop solar making what the sunshine allowed?</h1>
        <p className="lead">
          SuryaCheck compares your daily units with the real sunshine on your roof and with your neighbours.
          It tells you what you're losing in rupees, why, and the one thing to do about it.
        </p>
        <div className="row">
          {mine
            ? <button className="btn primary" onClick={() => go(`site/${mine}`)}>Open my roof</button>
            : <button className="btn primary" onClick={() => go('new')}>Check my roof</button>}
          {mine && <button className="btn" onClick={() => go('new')}>Add another roof</button>}
        </div>
      </section>

      <h2 className="section">Try a demo home</h2>
      <p className="muted small">Demo homes use real Ahmedabad weather with simulated panel data.</p>
      <div className="cards">
        {DEMOS.map((d) => (
          <button key={d.id} className="card demo" onClick={() => go(`site/${d.id}`)}>
            <span className="badge sim">Simulated</span>
            <strong>{d.name}</strong>
            <span className="muted">{d.blurb}</span>
          </button>
        ))}
      </div>
    </>
  )
}
