import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, ApiError, type EvidenceKind, type Extraction, type PhotoClass, type Row } from '../api'
import CameraCapture from './CameraCapture'
import { usePageMeta } from '../lib/seo'
import { prepareTiles } from '../image'
import { ArcLoader } from '../ui/arc'
import { Icon, type IconName } from '../ui/icons'
import { Badge, Button, Card, Notice } from '../ui/primitives'
import { useSite } from './siteContext'
import { Screen } from './States'

type Stage = 'pick' | 'reading' | 'confirm' | 'analyzing' | 'done'
type StepState = 'todo' | 'active' | 'done' | 'error'

const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
const lastDays = (n: number): Row[] => Array.from({ length: n }, (_, i) => {
  const d = new Date(todayIST() + 'T00:00:00'); d.setDate(d.getDate() - (n - i))
  return { date: d.toISOString().slice(0, 10), kwh: NaN }
})

function Picker({ icon, title, text, onFile, capture, multiple, file }: {
  icon: IconName; title: string; text: string; onFile: (f: File[]) => void; capture?: boolean; multiple?: boolean; file?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="picker">
      <span className="picker-icon"><Icon name={icon} size={24} /></span>
      <div><strong>{title}</strong><p className="muted small">{text}</p>{file && <Badge tone="clean" icon="check">{file}</Badge>}</div>
      <input ref={ref} type="file" accept="image/*" hidden multiple={multiple} {...(capture ? { capture: 'environment' } : {})}
        onChange={(e) => e.target.files?.length && onFile([...e.target.files])} />
      <Button variant="secondary" icon={capture ? 'camera' : 'upload'} onClick={() => ref.current?.click()}>{capture ? 'Take photo' : 'Choose'}</Button>
    </div>
  )
}

function Timeline({ steps }: { steps: [string, string, StepState][] }) {
  return (
    <ol className="timeline">
      {steps.map(([title, sub, st]) => (
        <li key={title} className={`tl-${st}`}>
          <span className="tl-dot">{st === 'done' ? <Icon name="check" size={14} /> : st === 'error' ? <Icon name="alert" size={14} /> : null}</span>
          <div><strong>{title}</strong><span className="muted small">{sub}</span></div>
        </li>
      ))}
    </ol>
  )
}

export default function NewCheck() {
  usePageMeta('New check')
  const { siteId, sample, base, reload, view } = useSite()
  const nav = useNavigate()
  const [stage, setStage] = useState<Stage>('pick')
  const [inverter, setInverter] = useState<{ file: File; kind: EvidenceKind } | null>(null)
  const [meter, setMeter] = useState<File | null>(null)
  const [panels, setPanels] = useState<File[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [meterTotal, setMeterTotal] = useState<number | null>(null)
  const [meterInfo, setMeterInfo] = useState<Extraction['values']>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [err, setErr] = useState('')
  const [steps, setSteps] = useState<Record<string, StepState>>({})
  const mark = (k: string, s: StepState) => setSteps((x) => ({ ...x, [k]: s }))
  const [seen, setSeen] = useState<{ name: string; cls: PhotoClass; note: string; keys?: string[] }[]>([])
  const [smartBusy, setSmartBusy] = useState(false)

  if (sample) return (
    <Screen title="New check" needsAnalysis={false}>
      <div className="state"><Notice tone="info" title="The sample system is read-only">
        Check your own roof, free and with no sign-up, with photos of your inverter, meter and panels.</Notice>
        <Link className="btn btn-primary" to="/app">Check my own roof</Link></div>
    </Screen>
  )

  const read = async () => {
    if (!siteId) return
    setStage('reading'); setErr(''); setWarnings([])
    const w: string[] = []
    let phase = 'upload'
    try {
      mark('upload', 'active')
      const invKeys = inverter ? await api.upload(siteId, await prepareTiles(inverter.file), inverter.kind) : []
      const meterKeys = meter ? await api.upload(siteId, await prepareTiles(meter), 'meter_photo') : []
      for (const p of panels) await api.upload(siteId, await prepareTiles(p), 'panel_photo')
      mark('upload', 'done'); mark('extract', 'active'); phase = 'extract'
      if (invKeys.length) {
        const ex = await api.extract(siteId, invKeys, inverter!.kind)
        setRows(ex.rows); w.push(...ex.warnings)
      }
      if (meterKeys.length) {
        const ex = await api.extract(siteId, meterKeys, 'meter_photo')
        setMeterInfo(ex.values ?? {}); setMeterTotal(ex.values?.total_kwh?.value ?? null); w.push(...ex.warnings)
      }
      mark('extract', 'done'); setWarnings(w); setStage('confirm')
    } catch (e) {
      mark(phase, 'error')
      setErr(e instanceof ApiError && e.status === 429 ? e.message : `${(e as Error).message} You can type the numbers instead.`)
      setRows(lastDays(7)); setStage('confirm')
    }
  }

  /** Smart camera: classify the photo (CLIP + Rekognition), then route it to the right reader. */
  const smart = async (file: File) => {
    if (!siteId) return
    setSmartBusy(true); setErr('')
    try {
      const tiles = await prepareTiles(file)
      const keys = await api.upload(siteId, tiles, 'camera')
      const cls = await api.classifyPhoto(siteId, keys[0])
      if (cls.kind_probs[cls.kind] < KIND_SURE && cls.kind !== 'other') {
        setSeen((x) => [{ name: file.name, cls, keys, note: 'Not sure what this is — tell us:' }, ...x])
        return
      }
      setSeen((x) => [{ name: file.name, cls, note: '' }, ...x])
      await route(keys, cls.kind, 0)
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 429 ? e.message : (e as Error).message)
    } finally { setSmartBusy(false) }
  }

  /** Send an upload to the reader for its kind and write the outcome onto seen[index]. */
  const route = async (keys: string[], kind: PhotoClass['kind'], index: number) => {
    if (!siteId) return
    setSmartBusy(true)
    try {
      let note = ''
      if (kind === 'inverter' || kind === 'screenshot') {
        const ex = await api.extract(siteId, keys, kind === 'inverter' ? 'inverter_photo' : 'inverter_screenshot')
        setRows((prev) => Object.values(Object.fromEntries([...prev, ...ex.rows].map((r) => [r.date, r]))).sort((a, b) => a.date.localeCompare(b.date)))
        setWarnings((w) => [...w, ...ex.warnings])
        note = ex.rows.length ? `Read ${ex.rows.length} day${ex.rows.length > 1 ? 's' : ''} of units with Amazon Textract.` : 'No units found on it — try straight on, without glare.'
      } else if (kind === 'meter') {
        const ex = await api.extract(siteId, keys, 'meter_photo')
        setMeterInfo(ex.values ?? {}); setMeterTotal(ex.values?.total_kwh?.value ?? null); setWarnings((w) => [...w, ...ex.warnings])
        note = ex.values?.total_kwh ? `Meter total ${ex.values.total_kwh.value} kWh.` : 'Could not read the meter total.'
      } else if (kind === 'panel') {
        note = 'Saved with your report.'
      } else {
        note = "That doesn't look like a panel, inverter or meter. Try again."
      }
      setSeen((x) => x.map((it, i) => (i !== index ? it : { ...it, note, keys: undefined,
        cls: it.cls.kind === kind ? it.cls : { ...it.cls, kind, chosen: true, condition: kind === 'panel' ? it.cls.condition : undefined } })))
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 429 ? e.message : (e as Error).message)
    } finally { setSmartBusy(false) }
  }

  const analyze = async () => {
    if (!siteId) return
    const clean = rows.filter((r) => Number.isFinite(r.kwh))
    if (!clean.length && meterTotal == null) { setErr('Add at least one day, or a meter reading.'); return }
    setStage('analyzing'); setErr(''); mark('confirm', 'done'); mark('compute', 'active')
    try {
      if (clean.length) {
        const r = await api.putReadings(siteId, clean, inverter ? 'screenshot' : 'manual')
        if (r.rejected.length) setWarnings(r.rejected.map((x) => `${x.date ?? ''} ${x.reason}`))
      }
      if (meterTotal != null) await api.addMeter(siteId, todayIST(), meterTotal)
      const { analysisId } = await api.startAnalysis(siteId)
      const a = await api.waitForAnalysis(siteId, analysisId)
      mark('compute', a.status === 'DONE' ? 'done' : 'error')
      if (a.status !== 'DONE') throw new Error(a.error ?? 'The analysis failed.')
      setStage('done'); await reload(); nav(`${base}/report`)
    } catch (e) { setErr((e as Error).message); setStage('confirm'); mark('compute', 'error') }
  }

  const edit = (i: number, k: keyof Row, v: string) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: k === 'kwh' ? (v === '' ? NaN : +v) : v } : r)))

  const timeline: [string, string, StepState][] = [
    ['Upload', 'Photos go to a private S3 bucket (deleted after 7 days)', steps.upload ?? 'todo'],
    ['Extract', 'Amazon Textract reads the numbers; our parser decides dates and kWh', steps.extract ?? 'todo'],
    ['Confirm', 'You check every value — nothing is saved until you do', stage === 'confirm' ? 'active' : steps.confirm ?? 'todo'],
    ['Fetch sunlight · compute · diagnose', 'Open-Meteo weather → pvlib expected yield → fixed rules, on AWS Lambda', steps.compute ?? 'todo'],
  ]

  return (
    <Screen title="New check" needsAnalysis={false}>
      <header className="screen-head"><div><p className="eyebrow">{view?.site.label ?? 'My roof'}</p><h1>New check</h1></div></header>
      <div className="check-grid">
        <div>
          {stage === 'pick' && (
            <Card className="smart-card">
              <h2 className="h3">Smart camera</h2>
              <p className="muted">One camera for everything. An image model works out what you photographed and sends it to the right reader.</p>
              <CameraCapture onCapture={smart} busy={smartBusy} />
              {seen.length > 0 && <ul className="seen">{seen.map((x, i) => (
                <PhotoResult key={i} cls={x.cls} note={x.note}>
                  {x.keys && <div className="row">{(['inverter', 'meter', 'panel'] as const).map((k) => (
                    <Button key={k} variant="secondary" disabled={smartBusy} onClick={() => route(x.keys!, k, i)}>
                      {k === 'inverter' ? "It's the inverter" : k === 'meter' ? "It's the meter" : "It's my panels"}</Button>))}</div>}
                </PhotoResult>))}</ul>}
              {(rows.length > 0 || meterTotal != null) && (
                <Button icon="arrowRight" onClick={() => setStage('confirm')}>Check the numbers</Button>
              )}
            </Card>
          )}
          {stage === 'pick' && (
            <Card>
              <h2 className="h3">Or add evidence one by one</h2>
              <p className="muted">The inverter numbers are what we analyse. Meter and panel photos are optional.</p>
              <Picker icon="inverter" title="Inverter app or display" capture={false}
                text="A screenshot of the daily or monthly list gives the most days at once."
                file={inverter?.kind === 'inverter_screenshot' ? inverter.file.name : undefined}
                onFile={([f]) => setInverter({ file: f, kind: 'inverter_screenshot' })} />
              <Picker icon="camera" title="…or photograph the inverter display" capture
                text="Point at the “Today” / “E-Today” number, straight on, no glare."
                file={inverter?.kind === 'inverter_photo' ? inverter.file.name : undefined}
                onFile={([f]) => setInverter({ file: f, kind: 'inverter_photo' })} />
              <Picker icon="meter" title="Meter reading (optional)" capture text="Generation or net meter. Two photos a few days apart give daily units."
                file={meter?.name} onFile={([f]) => setMeter(f)} />
              <Picker icon="panel" title="Panel photos (optional)" capture multiple text="Kept with your report for the visual check."
                file={panels.length ? `${panels.length} photo${panels.length > 1 ? 's' : ''}` : undefined} onFile={setPanels} />
              <div className="row" style={{ marginTop: 'var(--s-4)' }}>
                <Button icon="arrowRight" disabled={!inverter && !meter && !panels.length} onClick={read}>Read my evidence</Button>
                <Button variant="ghost" onClick={() => { setRows(lastDays(7)); setStage('confirm') }}>Type the numbers instead</Button>
              </div>
            </Card>
          )}

          {stage === 'reading' && <Card><ArcLoader label="Reading your photos" /><p className="muted">Reading your photos with Amazon Textract…</p></Card>}

          {(stage === 'confirm' || stage === 'analyzing') && (
            <Card>
              <h2 className="h3">2 · Check the numbers</h2>
              <p className="muted">Fix anything that doesn't match your inverter. Values are in kWh (units).</p>
              {meterTotal != null && (
                <div className="field">
                  <label htmlFor="meter-total">Generation meter total (kWh)</label>
                  <input id="meter-total" inputMode="decimal" value={meterTotal} onChange={(e) => setMeterTotal(+e.target.value)} />
                  {(meterInfo?.import_kwh || meterInfo?.export_kwh) && <p className="field-hint">Also read — import {meterInfo.import_kwh?.value ?? '—'},
                    export {meterInfo.export_kwh?.value ?? '—'} kWh (for reference; the analysis uses generation).</p>}
                </div>
              )}
              <table className="rows-table">
                <thead><tr><th scope="col">Date</th><th scope="col">kWh</th><th><span className="sr-only">Remove</span></th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td><input aria-label={`Date ${i + 1}`} type="date" value={r.date} max={todayIST()} onChange={(e) => edit(i, 'date', e.target.value)} /></td>
                      <td><input aria-label={`kWh on ${r.date}`} inputMode="decimal" value={Number.isFinite(r.kwh) ? r.kwh : ''} placeholder="—"
                        onChange={(e) => edit(i, 'kwh', e.target.value)} /></td>
                      <td><button className="btn btn-ghost icon-btn" aria-label={`Remove ${r.date}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Icon name="close" size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button variant="secondary" icon="plus" onClick={() => setRows([...rows, { date: todayIST(), kwh: NaN }])}>Add a day</Button>
              <p className="hint">At least 7 clear days are needed for a first verdict.</p>
              <Button block icon="sun" disabled={stage === 'analyzing'} onClick={analyze}>
                {stage === 'analyzing' ? 'Checking against the sunshine…' : 'Looks right — run the check'}
              </Button>
            </Card>
          )}
          {warnings.length > 0 && <Notice tone="dust" title="Please check">{<ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}</Notice>}
          {err && <Notice tone="fault" title="Something went wrong">{err}</Notice>}
        </div>
        <Card className="timeline-card"><p className="eyebrow">What happens</p><Timeline steps={timeline} /></Card>
      </div>
    </Screen>
  )
}

const KIND_LABEL: Record<string, string> = { panel: 'Solar panels', inverter: 'Inverter display', meter: 'Energy meter', screenshot: 'App screenshot', other: 'Not recognised' }
const COND_LABEL: Record<string, string> = { clean: 'Looks clean', dusty: 'Looks dusty', bird_droppings: 'Bird droppings', damaged: 'Possible damage', shaded: 'Shade on panels' }
const CONFIDENT = 0.6
const KIND_SURE = 0.6

/** One classified photo. Condition is shown only when the model is confident; otherwise we say so. */
export function PhotoResult({ cls, note, children }: { cls: PhotoClass; note: string; children?: React.ReactNode }) {
  const p = cls.kind_probs[cls.kind]
  const cp = cls.condition ? cls.condition_probs?.[cls.condition] ?? 0 : 0
  return (
    <li className="photo-result">
      <div className="row">
        <Badge tone={cls.kind === 'other' ? 'fault' : 'neutral'} icon={cls.kind === 'panel' ? 'panel' : cls.kind === 'meter' ? 'meter' : cls.kind === 'other' ? 'alert' : 'inverter'}>
          {KIND_LABEL[cls.kind]} · {cls.chosen ? 'chosen by you' : `${Math.round(p * 100)}%`}</Badge>
        {cls.rekognition?.solar_panels != null && <Badge tone="clean" icon="check">Rekognition: solar panels {Math.round(cls.rekognition.solar_panels)}%</Badge>}
        {cls.condition && (cp >= CONFIDENT
          ? <Badge tone={cls.condition === 'clean' ? 'clean' : 'dust'} icon={cls.condition === 'clean' ? 'check' : 'dust'}>{COND_LABEL[cls.condition]} · estimate</Badge>
          : <Badge>Condition: not sure yet</Badge>)}
      </div>
      {note && <p className="muted small">{note}</p>}
      {children}
    </li>
  )
}
