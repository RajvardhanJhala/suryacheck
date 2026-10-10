import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../api'
import { usePageMeta } from '../lib/seo'
import { Button, Card, Field, Notice } from '../ui/primitives'
import { useSite } from './siteContext'
import { Screen } from './States'

function SystemForm() {
  const { view, sample, siteId, setSiteId, reload } = useSite()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const s = view?.site
  const [f, setF] = useState({
    label: s?.label ?? 'My roof', lat: String(s?.lat ?? ''), lon: String(s?.lon ?? ''), capacity_kwp: String(s?.capacity_kwp ?? '3'),
    tilt: String(s?.tilt ?? 23), azimuth: String(s?.azimuth ?? 180), install_date: s?.install_date ?? '',
    tariff_inr: String(s?.tariff_inr ?? 6), cleaning_cost_inr: String(s?.cleaning_cost_inr ?? 200),
    installer_phone: s?.installer_phone ?? '', language: s?.language ?? 'en', notify_email: s?.notify_email ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'clean' | 'fault'; text: string } | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  const locate = () => navigator.geolocation?.getCurrentPosition(
    (p) => setF((x) => ({ ...x, lat: p.coords.latitude.toFixed(4), lon: p.coords.longitude.toFixed(4) })),
    () => setMsg({ tone: 'fault', text: 'Could not get your location. Type it in (Ahmedabad is 23.03, 72.58).' }), { timeout: 10000 })

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      const r = await api.saveMySite({
        label: f.label, lat: +f.lat, lon: +f.lon, capacity_kwp: +f.capacity_kwp, tilt: +f.tilt, azimuth: +f.azimuth,
        install_date: f.install_date || null, tariff_inr: +f.tariff_inr, cleaning_cost_inr: +f.cleaning_cost_inr,
        installer_phone: f.installer_phone || null, language: f.language as 'en' | 'hi', notify_email: f.notify_email,
      })
      if (!siteId) { setSiteId(r.siteId); nav('/app/check') } else { await reload(); setMsg({ tone: 'clean', text: 'Saved.' }) }
    } catch (x) { setMsg({ tone: 'fault', text: (x as Error).message }) } finally { setBusy(false) }
  }

  const welcome = params.get('welcome') && !siteId
  return (
    <>
      <header className="screen-head"><div><p className="eyebrow">Settings</p><h1>{welcome ? 'Set up your roof' : 'My system'}</h1></div></header>
      {welcome && <Notice tone="info" title="One minute of setup">We need where your roof is (for its sunshine) and its size. Everything else has sensible defaults.</Notice>}
      {sample && <Notice tone="info" title="Sample system settings are read-only" />}
      <form onSubmit={save} className="settings-grid">
        <fieldset disabled={sample || busy}>
          <Card>
            <h2 className="h3">Roof</h2>
            <Field id="label" label="Name" value={f.label} onChange={set('label')} />
            <div className="two-fields">
              <Field id="lat" label="Latitude" inputMode="decimal" required value={f.lat} onChange={set('lat')} />
              <Field id="lon" label="Longitude" inputMode="decimal" required value={f.lon} onChange={set('lon')} />
            </div>
            <Button type="button" variant="secondary" icon="pin" onClick={locate}>Use my location</Button>
            <Field id="kwp" label="System size (kWp)" inputMode="decimal" required value={f.capacity_kwp} onChange={set('capacity_kwp')} hint="On your installation papers or the inverter sticker. Most homes: 2–5 kWp." />
            <div className="two-fields">
              <Field id="tilt" label="Tilt (°)" inputMode="decimal" value={f.tilt} onChange={set('tilt')} hint="Default 23° suits Gujarat." />
              <Field id="az" label="Facing (azimuth °)" inputMode="decimal" value={f.azimuth} onChange={set('azimuth')} hint="180 = south." />
            </div>
            <Field id="installed" label="Installed on" type="date" value={f.install_date} onChange={set('install_date')} />
          </Card>
        </fieldset>
        <fieldset disabled={sample || busy}>
          <Card>
            <h2 className="h3">Money</h2>
            <Field id="tariff" label="Electricity rate (₹ per unit)" inputMode="decimal" value={f.tariff_inr} onChange={set('tariff_inr')} />
            <Field id="clean" label="One cleaning costs (₹)" inputMode="decimal" value={f.cleaning_cost_inr} onChange={set('cleaning_cost_inr')} />
            <Field id="phone" label="Installer's WhatsApp number" inputMode="tel" placeholder="+91…" value={f.installer_phone} onChange={set('installer_phone')} />
            <h2 className="h3">Preferences</h2>
            <div className="field">
              <label htmlFor="lang">Language for explanations</label>
              <select id="lang" value={f.language} onChange={set('language')}><option value="en">English</option><option value="hi">हिंदी</option></select>
            </div>
            <label className="check"><input type="checkbox" checked={f.notify_email} onChange={set('notify_email')} /> Email me when a recheck finishes</label>
            <p className="field-hint">Email notifications are saved now and sent once our email service leaves AWS sandbox mode.</p>
          </Card>
        </fieldset>
        {msg && <Notice tone={msg.tone} title={msg.text} />}
        {!sample && <Button type="submit" disabled={busy}>{busy ? 'Saving…' : siteId ? 'Save changes' : 'Save and add my readings'}</Button>}
      </form>
    </>
  )
}

export default function MySystem() {
  usePageMeta('My system')
  const { view } = useSite()
  return <Screen title="My system" needsAnalysis={false}><SystemForm key={view?.siteId ?? 'new'} /></Screen>
}
