import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, ApiError, type EvidenceKind, type PhotoClass, type Site } from '../api'
import { prepareTiles } from '../image'
import { gpsFromJpeg } from '../lib/exif'
import { usePageMeta } from '../lib/seo'
import { ArcLoader } from '../ui/arc'
import { shortDate } from '../ui/charts'
import { Icon, type IconName } from '../ui/icons'
import { Badge, Button, Field, Notice } from '../ui/primitives'
import CameraCapture from './CameraCapture'
import { PanelEstimate } from './photos'
import Results from './Results'
import { todayIST } from '../lib/verdict'
import { SAMPLES, useSite } from './siteContext'

type Loc = { lat: number; lon: number; label: string | null }
type Chip = { date: string; text: string; added?: boolean }
type Card = { url: string; status: 'reading' | 'done' | 'error'; error?: string } | null
type Stage = 'photos' | 'weather' | 'compare' | 'diagnose'
const STEPS: [Stage, string][] = [['photos', 'Reading photos'], ['weather', 'Fetching sunshine for your roof'],
  ['compare', 'Comparing with what the sun allowed'], ['diagnose', 'Diagnosing']]
const SHOWN_CHIPS = 7
const yesterday = () => { const d = new Date(todayIST() + 'T00:00:00'); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }
const kwhOf = (c: Chip) => (c.text.trim() === '' ? NaN : Number(c.text))

function mergeChips(prev: Chip[], rows: { date: string; kwh: number }[]): Chip[] {
  const m = new Map(prev.filter((c) => c.text !== '' || c.added).map((c) => [c.date, c]))
  for (const r of rows) m.set(r.date, { date: r.date, text: String(r.kwh) })
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function Capture({ n, icon, title, line, card, children }: { n: number; icon: IconName; title: string; line: string; card: Card; children: ReactNode }) {
  return (
    <section className={`capture${card?.status === 'done' ? ' is-done' : ''}`} aria-labelledby={`cap-${n}`}>
      <div className="capture-head">
        {card ? <span className="capture-thumb"><img src={card.url} alt="" />{card.status === 'done' && <span className="tick"><Icon name="check" size={14} /></span>}</span>
          : <span className="capture-icon"><Icon name={icon} size={22} /></span>}
        <div><h2 id={`cap-${n}`} className="capture-title">{n} · {title}</h2><p className="muted small">{line}</p></div>
      </div>
      {card?.status === 'reading' && <ArcLoader label={`Reading ${title.toLowerCase()}`} />}
      {card?.status === 'error' && <p className="field-error" role="alert">{card.error}</p>}
      {children}
    </section>
  )
}

function PickButtons({ onFile, busy, photoLabel = 'Take photo' }: { onFile: (f: File, how: 'camera' | 'upload') => void; busy?: boolean; photoLabel?: string }) {
  const cam = useRef<HTMLInputElement>(null), up = useRef<HTMLInputElement>(null)
  const pick = (how: 'camera' | 'upload') => (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) onFile(f, how); e.target.value = '' }
  return (
    <div className="row">
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={pick('camera')} />
      <input ref={up} type="file" accept="image/*" hidden onChange={pick('upload')} />
      <Button variant="secondary" icon="camera" disabled={busy} onClick={() => cam.current?.click()}>{photoLabel}</Button>
      <Button variant="ghost" icon="upload" disabled={busy} onClick={() => up.current?.click()}>Upload</Button>
    </div>
  )
}

export default function TestRoof() {
  const { siteId, view, analysis, analysisId, loading, error, sample, reload, setSiteId } = useSite()
  const [, setParams] = useSearchParams()
  usePageMeta('Test your roof', 'Photograph your inverter, meter and panels. SuryaCheck compares what you made with what the sunshine allowed.')

  const [editing, setEditing] = useState(false)
  const [loc, setLoc] = useState<Loc | null>(null)
  const [locState, setLocState] = useState<'idle' | 'asking' | 'denied'>('idle')
  const [place, setPlace] = useState('')
  const [kwp, setKwp] = useState('3')
  const [more, setMore] = useState({ tilt: '23', azimuth: '180', tariff_inr: '6', cleaning_cost_inr: '200', install_date: '' })
  const [chips, setChips] = useState<Chip[]>([])
  const [allChips, setAllChips] = useState(false)
  const [inv, setInv] = useState<Card>(null)
  const [invKind, setInvKind] = useState<EvidenceKind>('inverter_screenshot')
  const [meter, setMeter] = useState<Card>(null)
  const [meterText, setMeterText] = useState('')
  const [panels, setPanels] = useState<{ url: string; cls: PhotoClass | null; error?: string }[]>([])
  const [running, setRunning] = useState<Stage | null>(null)
  const [err, setErr] = useState('')
  const [warn, setWarn] = useState<string[]>([])
  const top = useRef<HTMLDivElement>(null)

  const site = view?.site
  // Prefill from this browser's saved site once it loads.
  useEffect(() => {
    if (!site || sample) return
    setLoc({ lat: site.lat, lon: site.lon, label: site.locality ?? null })
    setKwp(String(site.capacity_kwp))
    setMore({ tilt: String(site.tilt ?? 23), azimuth: String(site.azimuth ?? 180), tariff_inr: String(site.tariff_inr),
      cleaning_cost_inr: String(site.cleaning_cost_inr), install_date: site.install_date ?? '' })
  }, [site, sample])

  const fresh = !sample && !loading && !analysis      // nothing to show yet: go straight to the inputs
  const started = editing || chips.length > 0 || !!inv || !!meter || panels.length > 0
  const inputs = !sample && (started || fresh)

  // Ask the browser for the roof's position when the inputs are first shown and none is saved.
  useEffect(() => {
    if (!inputs || loc || locState !== 'idle' || loading) return
    if (!navigator.geolocation) { setLocState('denied'); return }
    setLocState('asking')
    navigator.geolocation.getCurrentPosition((p) => {
      setLoc({ lat: +p.coords.latitude.toFixed(4), lon: +p.coords.longitude.toFixed(4), label: null }); setLocState('idle')
    }, () => setLocState('denied'), { timeout: 10000, maximumAge: 600000 })
  }, [inputs, loc, locState, loading])

  // Name the place once we have a position but no name.
  useEffect(() => {
    if (!loc || loc.label) return
    let live = true
    api.locality(loc.lat, loc.lon)
      .then((r) => live && r.label && setLoc((l) => l && { ...l, label: r.label }))
      .catch(() => { /* the coordinates stay as the label */ })
    return () => { live = false }
  }, [loc])

  const findPlace = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    try { const r = await api.geocode(place); setLoc({ lat: r.lat, lon: r.lon, label: r.label }) } catch (x) { setErr((x as Error).message) }
  }

  const siteBody = (l: Loc): Partial<Site> => ({
    ...(site && !sample ? site : {}), lat: l.lat, lon: l.lon, capacity_kwp: +kwp || 3, tilt: +more.tilt, azimuth: +more.azimuth,
    tariff_inr: +more.tariff_inr, cleaning_cost_inr: +more.cleaning_cost_inr, install_date: more.install_date || null,
  })

  /** The site is created at the first photo, so nobody fills a form first. Photo GPS is the location fallback. */
  const ensureSite = async (file?: File): Promise<string> => {
    if (siteId && !sample) return siteId
    let l = loc
    if (!l && file) {
      const g = gpsFromJpeg(await file.slice(0, 262144).arrayBuffer())
      if (g) { l = { lat: +g.lat.toFixed(4), lon: +g.lon.toFixed(4), label: null }; setLoc(l) }
    }
    if (!l) throw new Error('First tell us where the roof is: allow location, or type your area or PIN code.')
    const r = await api.createSite(siteBody(l))
    setSiteId(r.siteId)
    return r.siteId
  }

  const readInverter = async (file: File, how: 'camera' | 'upload') => {
    const kind: EvidenceKind = how === 'camera' ? 'inverter_photo' : 'inverter_screenshot'
    setInv({ url: URL.createObjectURL(file), status: 'reading' }); setInvKind(kind)
    try {
      const sid = await ensureSite(file)
      const keys = await api.upload(sid, await prepareTiles(file), kind)
      // A phone photo is often of the app's daily list, so read it as a list first; fall back to the
      // single "Today" number on an inverter display only when no list is found.
      let ex = await api.extract(sid, keys, 'inverter_screenshot')
      if (ex.rows.length < 2 && kind === 'inverter_photo') {
        const today = await api.extract(sid, keys, 'inverter_photo')
        if (today.rows.length) ex = { ...today, rows: [...ex.rows.filter((r) => !today.rows.some((t) => t.date === r.date)), ...today.rows] }
      }
      setWarn(ex.warnings)
      if (!ex.rows.length) throw new Error("Couldn't find daily units in that image. Type them below, or upload a screenshot of the app's daily list.")
      setChips((c) => mergeChips(c, ex.rows)); setInv((c) => c && { ...c, status: 'done' })
    } catch (e) {
      setInv((c) => c && { ...c, status: 'error', error: e instanceof ApiError && e.status === 429 ? e.message : (e as Error).message })
      setChips((c) => (c.length ? c : [{ date: yesterday(), text: '', added: true }]))
    }
  }

  const readMeter = async (file: File) => {
    setMeter({ url: URL.createObjectURL(file), status: 'reading' })
    try {
      const sid = await ensureSite(file)
      const keys = await api.upload(sid, await prepareTiles(file), 'meter_photo')
      const ex = await api.extract(sid, keys, 'meter_photo')
      const total = ex.values?.total_kwh?.value
      if (total == null) throw new Error("Couldn't read the solar generation total. Type it below, or skip the meter.")
      setMeterText(String(total)); setMeter((c) => c && { ...c, status: 'done' })
    } catch (e) { setMeter((c) => c && { ...c, status: 'error', error: (e as Error).message }) }
  }

  const shootPanel = async (file: File) => {
    const url = URL.createObjectURL(file)
    setPanels((p) => [...p, { url, cls: null }])
    const set = (x: Partial<{ cls: PhotoClass | null; error: string }>) => setPanels((p) => p.map((it) => (it.url === url ? { ...it, ...x } : it)))
    try {
      const sid = await ensureSite(file)
      const keys = await api.upload(sid, await prepareTiles(file), 'panel_photo')
      set({ cls: await api.classifyPhoto(sid, keys[0]) })
    } catch (e) { set({ error: (e as Error).message }) }
  }

  const valid = chips.filter((c) => Number.isFinite(kwhOf(c)) && kwhOf(c) >= 0)
  const run = async () => {
    setErr(''); setWarn([]); setRunning('photos')
    try {
      const sid = await ensureSite()
      await api.updateSite(sid, siteBody(loc!))
      const r = await api.putReadings(sid, valid.map((c) => ({ date: c.date, kwh: kwhOf(c) })), inv ? (invKind === 'inverter_photo' ? 'photo' : 'screenshot') : 'manual')
      if (r.rejected.length) setWarn(r.rejected.map((x) => `${x.date ? shortDate(x.date) + ': ' : ''}${x.reason}`))
      if (meterText.trim() !== '' && Number.isFinite(+meterText)) await api.addMeter(sid, todayIST(), +meterText)
      setRunning('weather')
      const { analysisId: aid } = await api.startAnalysis(sid)
      const a = await api.waitForAnalysis(sid, aid, (x) => x.stage && x.stage !== 'done' && setRunning(x.stage))
      if (a.status !== 'DONE') throw new Error(a.stage === 'weather'
        ? "Couldn't fetch the sunshine for your roof from Open-Meteo. Try again in a minute." : `The check failed: ${a.error ?? 'unknown error'}.`)
      await reload()
      setEditing(false); setChips([]); setInv(null); setMeter(null); setMeterText(''); setPanels([])     // show the result
      top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (e) { setErr((e as Error).message) } finally { setRunning(null) }
  }

  const startEdit = () => {
    setChips(mergeChips([], (view?.readings ?? []).slice(-30)))
    setInv(null); setMeter(null); setPanels([]); setEditing(true)
  }

  // Full-page loader only before anything has been added: creating the site on the first photo reloads it.
  if (loading && !started) return <div className="center-screen"><ArcLoader label="Loading your roof" /></div>
  if (error && !inputs) return (
    <div className="state"><Notice tone="fault" title="Couldn't load this roof">{error}</Notice>
      <Button variant="secondary" icon="history" onClick={reload}>Try again</Button></div>
  )

  const head = (
    <header className="test-head" ref={top}>
      <h1>{sample ? 'Sample roof' : inputs ? 'Test your roof' : 'Your roof'}</h1>
      {sample && <div className="row">
        <Badge tone="sun" icon="info">Sample data</Badge>
        <label className="sr-only" htmlFor="sample-pick">Sample roof</label>
        <select id="sample-pick" value={siteId ?? ''} onChange={(e) => setParams({ sample: e.target.value })}>
          {SAMPLES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>}
    </header>
  )

  if (!inputs && view && analysis) {
    const rs = view.readings
    const last = rs.at(-1)
    return (
      <div className="test">
        {head}
        <div className="readings-summary">
          <span><Icon name="inverter" size={18} />{rs.length} days of units{last ? ` · latest ${last.kwh} kWh on ${shortDate(last.date)}` : ''}</span>
          {(view.panelPhotos?.length ?? 0) > 0 && <span><Icon name="panel" size={18} />{view.panelPhotos!.length} panel photos</span>}
          {sample ? <Link to="/test" className="btn btn-ghost" onClick={() => setParams({})}>Test your own roof</Link>
            : <Button variant="ghost" icon="camera" onClick={startEdit}>Edit and re-run</Button>}
        </div>
        {analysis.status === 'FAILED' ? <Notice tone="fault" title="The last check failed">{analysis.error}</Notice>
          : <Results view={view} analysis={analysis} analysisId={analysisId} sample={sample} onEdit={sample ? undefined : startEdit} reload={reload} />}
      </div>
    )
  }

  const shown = allChips ? chips : chips.slice(-SHOWN_CHIPS)
  return (
    <div className="test">
      {head}
      <div className="where">
        <div className="where-loc">
          <span className="eyebrow">Roof location</span>
          {loc ? <span><Icon name="pin" size={16} />{loc.label ?? `${loc.lat}, ${loc.lon}`} <button className="link-btn" onClick={() => { setLoc(null); setLocState('denied') }}>Change</button></span>
            : locState === 'asking' ? <span className="muted">Finding your location…</span>
              : <form className="row" onSubmit={findPlace}>
                <label className="sr-only" htmlFor="place">Area or PIN code</label>
                <input id="place" className="input" placeholder="Area or PIN code" value={place} onChange={(e) => setPlace(e.target.value)} />
                <Button type="submit" variant="secondary" disabled={place.trim().length < 3}>Find</Button>
              </form>}
        </div>
        <Field id="kwp" label="System size (kWp)" inputMode="decimal" value={kwp} onChange={(e) => setKwp(e.target.value)} />
      </div>

      <p className="muted small">The inverter reading is required. Meter and panel photos make the result stronger.</p>

      <Capture n={1} icon="inverter" title="Inverter reading" line="A screenshot of your inverter app's daily list works best: one image gives many days." card={inv}>
        {chips.length > 0 && <>
          <ul className="chips" aria-label="Daily units read from your image">
            {shown.map((c) => (
              <li key={c.date} className="chip">
                {c.added ? <input type="date" aria-label="Date" value={c.date} max={todayIST()}
                  onChange={(e) => setChips((cs) => cs.map((x) => (x === c ? { ...x, date: e.target.value } : x)))} />
                  : <span className="chip-date">{shortDate(c.date)}</span>}
                <input inputMode="decimal" aria-label={`Units on ${shortDate(c.date)}`} value={c.text}
                  onChange={(e) => setChips((cs) => cs.map((x) => (x === c ? { ...x, text: e.target.value } : x)))} />
                <span className="chip-unit">kWh</span>
                <button className="chip-x" aria-label={`Remove ${shortDate(c.date)}`} onClick={() => setChips((cs) => cs.filter((x) => x !== c))}><Icon name="close" size={14} /></button>
              </li>
            ))}
          </ul>
          <div className="row">
            {chips.length > SHOWN_CHIPS && <button className="link-btn" onClick={() => setAllChips((x) => !x)}>{allChips ? 'Show fewer' : `Show all ${chips.length} days`}</button>}
            <button className="link-btn" onClick={() => setChips((cs) => [...cs, { date: yesterday(), text: '', added: true }])}>Add a day</button>
          </div>
        </>}
        <PickButtons onFile={readInverter} busy={inv?.status === 'reading'} />
        {chips.length === 0 && !inv && <button className="link-btn" onClick={() => setChips([{ date: yesterday(), text: '', added: true }])}>or type the units</button>}
      </Capture>

      <Capture n={2} icon="meter" title="Net-meter reading" line="Optional. A photo of the solar generation total on your meter." card={meter}>
        {(meter || meterText) && <div className="chips"><label className="chip"><span className="chip-date">Total</span>
          <input inputMode="decimal" aria-label="Solar generation total in kWh" value={meterText} onChange={(e) => setMeterText(e.target.value)} /><span className="chip-unit">kWh</span></label></div>}
        <PickButtons onFile={(f) => readMeter(f)} busy={meter?.status === 'reading'} />
      </Capture>

      <Capture n={3} icon="panel" title="Panel photos" line="Optional. 1–3 shots; fit the panels inside the frame and avoid glare." card={null}>
        {panels.length > 0 && <ul className="shots">{panels.map((p) => (
          <li key={p.url}><img src={p.url} alt="Your panel photo" />{p.error ? <span className="field-error small">{p.error}</span> : <PanelEstimate cls={p.cls} />}</li>
        ))}</ul>}
        <CameraCapture onCapture={shootPanel} hint="Fit the panels inside the frame, avoid glare" done={panels.length >= 3} />
      </Capture>

      <details className="assumptions">
        <summary>Adjust assumptions</summary>
        <div className="assumption-grid">
          <Field id="tilt" label="Tilt (°)" inputMode="decimal" value={more.tilt} onChange={(e) => setMore({ ...more, tilt: e.target.value })} />
          <Field id="az" label="Facing (° from north, 180 = south)" inputMode="decimal" value={more.azimuth} onChange={(e) => setMore({ ...more, azimuth: e.target.value })} />
          <Field id="tariff" label="Electricity rate (₹/unit)" inputMode="decimal" value={more.tariff_inr} onChange={(e) => setMore({ ...more, tariff_inr: e.target.value })} />
          <Field id="cost" label="One cleaning costs (₹)" inputMode="decimal" value={more.cleaning_cost_inr} onChange={(e) => setMore({ ...more, cleaning_cost_inr: e.target.value })} />
          <Field id="installed" label="Installed on" type="date" value={more.install_date} onChange={(e) => setMore({ ...more, install_date: e.target.value })} />
        </div>
      </details>

      {warn.length > 0 && <Notice tone="info" title="Check these">{<ul>{warn.map((w) => <li key={w}>{w}</li>)}</ul>}</Notice>}
      {err && <Notice tone="fault" title={err} />}

      {running ? (
        <ol className="progress" aria-live="polite">
          {STEPS.map(([k, label], i) => {
            const at = STEPS.findIndex(([s]) => s === running)
            const st = i < at ? 'done' : i === at ? 'active' : 'todo'
            return <li key={k} className={`p-${st}`}>{st === 'done' ? <Icon name="check" size={16} /> : st === 'active' ? <ArcLoader size={28} label={label} /> : <span className="p-dot" />}{label}</li>
          })}
        </ol>
      ) : (
        <div className="run">
          <Button onClick={run} disabled={!valid.length || !loc}>Check my roof</Button>
          {!valid.length && <span className="muted small">Add the inverter reading first.</span>}
          {editing && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
        </div>
      )}
    </div>
  )
}
