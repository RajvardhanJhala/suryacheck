import { useState } from 'react'
import { api } from '../api'
import { go } from '../LegacyApp'

export default function Setup() {
  const [f, setF] = useState({ lat: '', lon: '', capacity_kwp: '3', tariff_inr: '6', cleaning_cost_inr: '200', installer_phone: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const locate = () => {
    setErr('')
    navigator.geolocation?.getCurrentPosition(
      (p) => setF((s) => ({ ...s, lat: p.coords.latitude.toFixed(4), lon: p.coords.longitude.toFixed(4) })),
      () => setErr('Could not get your location. Type it in, or use Ahmedabad: 23.03, 72.58.'),
      { enableHighAccuracy: false, timeout: 10000 })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const { siteId } = await api.createSite({
        lat: +f.lat, lon: +f.lon, capacity_kwp: +f.capacity_kwp, tariff_inr: +f.tariff_inr,
        cleaning_cost_inr: +f.cleaning_cost_inr, installer_phone: f.installer_phone || undefined,
      })
      try { localStorage.setItem('suryacheck.site', siteId) } catch { /* private mode */ }
      go(`site/${siteId}/add`)
    } catch (e) {
      setErr((e as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h1>Your roof</h1>
      <p className="muted">We only need the location of your roof (to get its sunshine) and the system size.</p>

      <label>Location</label>
      <div className="row">
        <input inputMode="decimal" placeholder="Latitude" value={f.lat} onChange={set('lat')} required />
        <input inputMode="decimal" placeholder="Longitude" value={f.lon} onChange={set('lon')} required />
      </div>
      <button type="button" className="btn small" onClick={locate}>📍 Use my location</button>

      <label htmlFor="kwp">System size (kW)</label>
      <input id="kwp" inputMode="decimal" value={f.capacity_kwp} onChange={set('capacity_kwp')} required />
      <p className="hint">On your installation papers or the inverter sticker. Most homes have 2–5 kW.</p>

      <details>
        <summary>Money settings (optional)</summary>
        <label htmlFor="tariff">Your electricity rate (₹ per unit)</label>
        <input id="tariff" inputMode="decimal" value={f.tariff_inr} onChange={set('tariff_inr')} />
        <label htmlFor="clean">What a cleaning costs you (₹)</label>
        <input id="clean" inputMode="decimal" value={f.cleaning_cost_inr} onChange={set('cleaning_cost_inr')} />
        <label htmlFor="phone">Installer's WhatsApp number</label>
        <input id="phone" inputMode="tel" placeholder="+91…" value={f.installer_phone} onChange={set('installer_phone')} />
      </details>

      {err && <p className="error">{err}</p>}
      <button className="btn primary block" disabled={busy}>{busy ? 'Saving…' : 'Next: add your daily units'}</button>
    </form>
  )
}
