import { useEffect, useState } from 'react'
import { api, type Analysis, type Cleaner, type SiteView } from '../api'
import { VERDICT } from '../lib/i18n'
import { ArcLoader } from '../ui/arc'
import { Icon } from '../ui/icons'
import { Button, Notice } from '../ui/primitives'

const MOBILE_IN = /^\+91[6-9]\d{9}$/     // WhatsApp only works on mobiles; Indian landlines start with an area code

function message(view: SiteView, a: Analysis) {
  const gap = a.performance.med3_latest == null ? null : Math.max(0, Math.round((1 - a.performance.med3_latest) * 100))
  return `Hello, I'd like my rooftop solar cleaned. ${view.site.capacity_kwp} kWp system${view.site.locality ? ` in ${view.site.locality}` : ''}. `
    + `SuryaCheck says: ${VERDICT[a.verdict]?.en ?? a.verdict}${gap ? `, output ${gap}% below what the sunshine allowed` : ''}`
    + `${a.monthly_loss_inr > 0 ? ` (about ₹${a.monthly_loss_inr} a month lost)` : ''}. When could you come?`
}

function Diy() {
  return (
    <div className="diy">
      <strong>Cleaning it yourself</strong>
      <ul className="small">
        <li>Early morning or evening, when the glass is cool.</li>
        <li>Plain water and a soft wet cloth or sponge. No detergent, no scrubbing pads.</li>
        <li>No high-pressure jet, and never stand on the panels.</li>
      </ul>
    </div>
  )
}

/** Real solar businesses near the roof (CleaningProvider on the backend). Never invented names or prices. */
export default function Cleaners({ view, analysis: a, analysisId, sample }: { view: SiteView; analysis: Analysis; analysisId: string | null; sample: boolean }) {
  const [state, setState] = useState<{ status: 'loading' | 'done' | 'error'; providers: Cleaner[]; source: string; error?: string }>({ status: 'loading', providers: [], source: '' })
  const [booked, setBooked] = useState<Record<string, string>>({})
  const text = message(view, a)

  useEffect(() => {
    let live = true
    api.cleaners(view.siteId)
      .then((r) => live && setState({ status: 'done', providers: r.providers, source: r.source }))
      .catch((e) => live && setState({ status: 'error', providers: [], source: '', error: (e as Error).message }))
    return () => { live = false }
  }, [view.siteId])

  const book = async (p: Cleaner) => {
    setBooked((b) => ({ ...b, [p.id]: 'Sending…' }))
    try {
      const r = await api.book(view.siteId, p, analysisId)
      setBooked((b) => ({ ...b, [p.id]: r.status === 'EMAILED' ? 'Request sent' : 'Request logged' }))
    } catch (e) { setBooked((b) => ({ ...b, [p.id]: (e as Error).message })) }
  }

  const installer = (view.site.installer_phone ?? '').replace(/[^\d]/g, '')
  return (
    <section id="cleaners" className="cleaners" aria-labelledby="cleaners-h">
      <h2 id="cleaners-h" className="h3">Cleaners nearby</h2>
      {state.status === 'loading' && <ArcLoader label="Finding solar businesses near you" />}
      {state.status === 'error' && <Notice tone="fault" title={state.error ?? 'Cleaner search is unavailable right now.'} />}
      {state.status === 'done' && state.providers.length > 0 && <>
        <ul className="cleaner-list">
          {state.providers.map((p) => (
            <li key={p.id} className="cleaner">
              <div className="cleaner-info">
                <strong>{p.name}</strong>
                <span className="muted small">{p.distance_km} km{p.area ? ` · ${p.area}` : ''}</span>
              </div>
              <div className="cleaner-actions">
                {p.phone && <a className="btn btn-secondary" href={`tel:${p.phone}`} aria-label={`Call ${p.name}`}><Icon name="phone" size={18} />Call</a>}
                {p.phone && MOBILE_IN.test(p.phone) && <a className="btn btn-secondary" target="_blank" rel="noopener"
                  href={`https://wa.me/${p.phone.replace('+', '')}?text=${encodeURIComponent(text)}`} aria-label={`WhatsApp ${p.name}`}><Icon name="chat" size={18} />WhatsApp</a>}
                {!sample && (booked[p.id]
                  ? <span className="muted small" role="status">{booked[p.id]}</span>
                  : <Button variant="ghost" icon="mail" onClick={() => book(p)}>Request booking</Button>)}
              </div>
            </li>
          ))}
        </ul>
        <p className="muted small">Solar businesses within 30 km, from {state.source}. Not verified by SuryaCheck; ask for a quote before booking.</p>
      </>}
      {state.status !== 'loading' && state.providers.length === 0 && <>
        {state.status === 'done' && <p className="muted">No solar businesses found within 30 km.</p>}
        <a className="btn btn-secondary" target="_blank" rel="noopener" href={`https://wa.me/${installer}?text=${encodeURIComponent(text)}`}>
          <Icon name="chat" size={18} />{installer ? 'WhatsApp my installer' : 'Send this to my installer on WhatsApp'}</a>
      </>}
      <Diy />
    </section>
  )
}
