import { useEffect, useState, type ReactNode } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type Action, type Analysis, type SiteView } from '../api'
import { VERDICT } from '../lib/i18n'
import { DUSTY, LOSS_LABEL, verdictSentence } from '../lib/verdict'
import { cumulative, inputsFromAnalysis, recoveredPerCleaning } from '../lib/money'
import { ArcGauge } from '../ui/arc'
import { axis, grid, legend, shortDate, tooltip } from '../ui/charts'
import { Icon, type IconName } from '../ui/icons'
import { Badge, Button, Notice, Reading } from '../ui/primitives'
import Cleaners from './Cleaners'
import { PanelEstimate } from './photos'

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
const TONE_ICON: Record<string, IconName> = { clean: 'check', fault: 'bolt', dust: 'dust', neutral: 'cloud' }
/** Collapsed by default; children (charts) only render once opened, or when printing. */
function Section({ title, summary, force, children }: { title: string; summary?: string; force?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const shown = open || !!force
  return (
    <details className="dsec" open={shown} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary><span className="section-title">{title}</span>{summary && <span className="muted small">{summary}</span>}</summary>
      {shown && <div className="section-body">{children}</div>}
    </details>
  )
}

function Recheck({ action }: { action: Action }) {
  const r = action.recheck_result
  if (action.outcome === 'RECOVERED' && r) return (
    <Notice tone="clean" title={`Recheck: ${inr(r.recovered_inr_month ?? 0)} a month recovered`}>
      After the cleaning, output went from {Math.round((r.pre_pi_norm ?? 0) * 100)}% to {Math.round(Math.min(1, r.post_pi_norm ?? 0) * 100)}% of normal.
    </Notice>
  )
  if (action.outcome === 'NOT_RECOVERED') return <Notice tone="fault" title="Cleaning didn't bring the units back, so it isn't dust.">Send the evidence to your installer.</Notice>
  if (action.outcome === 'PENDING' || action.outcome === 'WAITING_FOR_DATA') return (
    <Notice tone="info" title="Recheck scheduled">
      {action.outcome === 'WAITING_FOR_DATA' ? 'Waiting for a few more days of units. ' : ''}We'll compare again around{' '}
      {action.recheck_at ? new Date(action.recheck_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'soon'}.
    </Notice>
  )
  return null
}

function MoneyYear({ a, tariff, cost }: { a: Analysis; tariff: number; cost: number }) {
  const inp = inputsFromAnalysis(a, tariff, cost)
  const [day, setDay] = useState(0)
  const wait = cumulative(inp, null), clean = cumulative(inp, day)
  const be = clean.findIndex((v, i) => i >= day && v <= wait[i])
  const start = new Date(inp.today + 'T00:00:00')
  const dateAt = (i: number) => { const d = new Date(start); d.setDate(start.getDate() + i); return d }
  const label = (i: number) => dateAt(i).toLocaleDateString('en-IN', { month: 'short' })
  const md = (i: number) => (dateAt(i).getMonth() + 1) * 100 + dateAt(i).getDate()
  const monsoon = [...Array(365).keys()].filter((i) => md(i) >= 615 && md(i) <= 915)
  const data = [...Array(365).keys()].filter((i) => i % 7 === 0 || i === 364).map((i) => ({ i, wait: Math.round(wait[i]), clean: Math.round(clean[i]) }))
  return (
    <>
      <div className="field">
        <label htmlFor="clean-day">Clean {day === 0 ? 'today' : `in ${day} days`}</label>
        <input id="clean-day" type="range" min={0} max={120} step={1} value={day} onChange={(e) => setDay(+e.target.value)} />
      </div>
      <p>Over 12 months: wait <strong className="reading md is-dust">{inr(wait[364])}</strong> · clean {day === 0 ? 'today' : `in ${day} days`}{' '}
        <strong className="reading md is-clean">{inr(clean[364])}</strong> <span className="muted small">(₹{cost} cleaning included)</span></p>
      <p className="muted small">{be >= 0 ? `The cleaning has paid for itself by ${shortDate(dateAt(be).toISOString().slice(0, 10))}.` : 'At this dust rate, a cleaning does not pay for itself within a year.'}</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ left: -4, right: 8, top: 8 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="i" type="number" domain={[0, 364]} ticks={[0, 61, 122, 183, 244, 305]} tickFormatter={label} {...axis} />
          <YAxis {...axis} tickFormatter={(v) => `₹${v}`} />
          {monsoon.length > 0 && <ReferenceArea x1={monsoon[0]} x2={monsoon.at(-1)} fill="var(--clean)" fillOpacity={0.08}
            label={{ value: 'Monsoon: rain cleans', position: 'insideTop', fontSize: 11, fill: 'var(--ink-2)' }} />}
          <Tooltip {...tooltip} labelFormatter={(i) => shortDate(dateAt(Number(i)).toISOString().slice(0, 10))} formatter={(v) => inr(Number(v))} />
          <Legend {...legend} />
          <Line isAnimationActive={false} dataKey="wait" name="Wait (dust loss)" stroke="var(--dust)" strokeWidth={2.5} dot={false} />
          <Line isAnimationActive={false} dataKey="clean" name="Clean (loss + cost)" stroke="var(--clean)" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </>
  )
}

export default function Results({ view, analysis: a, analysisId, sample, onEdit, reload }: {
  view: SiteView; analysis: Analysis; analysisId: string | null; sample: boolean; onEdit?: () => void; reload: () => Promise<void>
}) {
  const v = VERDICT[a.verdict] ?? VERDICT.UNEXPLAINED
  const pr = a.performance.med3_latest
  const dusty = DUSTY.includes(a.verdict)
  const tariff = view.site.tariff_inr, cost = view.site.cleaning_cost_inr
  const inp = inputsFromAnalysis(a, tariff, cost)
  const year = cumulative(inp, null)[364]
  const recovered = recoveredPerCleaning(inp)
  const mine = view.actions.filter((x) => (x as { analysis_id?: string }).analysis_id === analysisId)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [printing, setPrinting] = useState(false)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    if (pr == null) return
    const prev = document.title
    document.title = `${Math.round(pr * 100)}% · ${v.en} · SuryaCheck`
    return () => { document.title = prev }
  }, [pr, v.en])

  useEffect(() => {
    if (!printing) return
    const id = requestAnimationFrame(() => { window.print(); setPrinting(false) })
    return () => cancelAnimationFrame(id)
  }, [printing])

  const act = async (type: string) => {
    if (!analysisId) return
    setBusy(true); setErr('')
    try {
      const r = await api.createAction(view.siteId, analysisId, type)
      if (type === 'MESSAGE_INSTALLER') window.open(r.whatsapp_url ?? `https://wa.me/?text=${encodeURIComponent(verdictSentence(a))}`, '_blank', 'noopener')
      await reload()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const share = async () => {
    const url = `${location.origin}/r/${view.siteId}`
    try {
      if (navigator.share) await navigator.share({ title: 'My SuryaCheck report', url })
      else { await navigator.clipboard.writeText(url); setCopied('Link copied') }
    } catch { setCopied(url) }
  }

  const series = a.series.map((p) => ({ ...p, d: shortDate(p.date),
    gap: p.actual != null && p.actual < p.expected ? [p.actual, p.expected] : null,
    you: p.pi_norm == null ? null : Math.round(p.pi_norm * 100), peers: p.peer_pi_norm == null ? null : Math.round(p.peer_pi_norm * 100) }))
  const trend = series.filter((p) => p.you != null)
  const photos = view.panelPhotos ?? []

  const primary = dusty && a.allowed_actions[a.verdict]?.includes('CLEAN_PANELS')
    ? <a className="btn btn-primary" href="#cleaners"><Icon name="droplet" size={18} />Get it cleaned</a>
    : (a.verdict === 'FAULT' || a.verdict === 'INVERTER_TRIP') && !sample
      ? <Button icon="chat" disabled={busy} onClick={() => act('MESSAGE_INSTALLER')}>Send the evidence to my installer</Button>
      : a.verdict === 'INSUFFICIENT_DATA' && onEdit ? <Button icon="plus" onClick={onEdit}>Add more days</Button> : null

  return (
    <div className="results">
      <section className={`verdict tone-${v.tone}`} aria-labelledby="verdict-word">
        {pr != null && <ArcGauge value={pr} label={null} size={240} />}
        <div className="verdict-text">
          <p className="eyebrow">{view.site.locality ?? view.site.label ?? 'Your roof'} · {view.site.capacity_kwp} kWp · {shortDate(a.as_of)}</p>
          <h1 id="verdict-word" className={`verdict-word is-${v.tone}`}><Icon name={TONE_ICON[v.tone]} size={28} />{v.en}</h1>
          <p className="verdict-line">{verdictSentence(a)}</p>
        </div>
        {a.monthly_loss_inr > 0 && (
          <dl className="money-row">
            <div><dt>Lost this month</dt><dd><Reading value={a.monthly_loss_inr} prefix="₹" tone="dust" /></dd><dd className="muted small">at today's rate</dd></div>
            <div><dt>Next 12 months</dt><dd><Reading value={year} prefix="₹" tone="dust" /></dd><dd className="muted small">if left alone</dd></div>
            {dusty && <div><dt>Recovered per cleaning</dt><dd><Reading value={recovered} prefix="₹" tone="clean" /></dd><dd className="muted small">over the next year</dd></div>}
          </dl>
        )}
        {a.monthly_loss_inr > 0 && <p className="muted small loss-def">{LOSS_LABEL} (₹{tariff}/unit).</p>}
        {primary && <div className="verdict-action">{primary}</div>}
        {err && <Notice tone="fault" title={err} />}
      </section>

      {mine.map((x, i) => <Recheck key={i} action={x} />)}

      <div className="sections">
        <Section title="Actual vs expected" summary={`${a.series.filter((p) => p.actual != null).length} days`} force={printing}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={series} margin={{ left: -16, right: 8 }}>
              <CartesianGrid {...grid} /><XAxis dataKey="d" {...axis} minTickGap={24} /><YAxis {...axis} />
              <Tooltip {...tooltip} formatter={(val, name) => (name === 'Lost' || !Number.isFinite(Number(val)) ? null : `${Number(val).toFixed(1)} kWh`)} />
              <Legend {...legend} />
              <Area isAnimationActive={false} dataKey="gap" name="Lost" fill="var(--dust)" fillOpacity={0.35} stroke="none" legendType="square" />
              <Bar isAnimationActive={false} dataKey="actual" name="Your units (kWh)" fill="var(--sun)" radius={[3, 3, 0, 0]} />
              <Line isAnimationActive={false} dataKey="expected" name="Sunshine allowed" stroke="var(--ink)" strokeDasharray="5 4" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
          {trend.length >= 5 && <>
            <p className="muted small">% of your normal on clear days. Below 92% something is costing you.</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trend} margin={{ left: -16, right: 8 }}>
                <CartesianGrid {...grid} /><XAxis dataKey="d" {...axis} minTickGap={24} /><YAxis {...axis} domain={[60, 110]} />
                <Tooltip {...tooltip} formatter={(val) => `${val}%`} />
                <ReferenceLine y={92} stroke="var(--clean)" strokeDasharray="4 4" />
                <Line isAnimationActive={false} dataKey="you" name="You" stroke="var(--dust)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </>}
        </Section>

        <Section title="Panel photo check" summary={photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}` : 'no photos'} force={printing}>
          {photos.length ? <div className="photos">{photos.map((p) => (
            <figure key={p.url} className="photo">
              <img src={p.url} alt={`Panel photo taken ${new Date(p.taken).toLocaleDateString('en-IN')}`} loading="lazy" />
              <figcaption><PanelEstimate cls={p.classification} /></figcaption>
            </figure>
          ))}</div> : <p className="muted">No panel photos with this test.</p>}
          <p className="muted small">Visual estimate. The verdict comes from your measured output.</p>
        </Section>

        {a.monthly_loss_inr > 0 && <Section title="Money over 12 months" summary={`${inr(year)} if left`} force={printing}>
          <MoneyYear a={a} tariff={tariff} cost={cost} />
        </Section>}

        <Section title="How we worked this out" force={printing}>
          <ul className="small method-list">
            <li>Sunshine for your roof each hour: Open-Meteo. What it allows: pvlib (Hay–Davies sky model, Faiman temperature, PVWatts) for {view.site.capacity_kwp} kWp at {view.site.tilt ?? 23}° facing {(view.site.azimuth ?? 180) === 180 ? 'south' : `${view.site.azimuth}°`}.</li>
            <li>Your normal: your best 7 clear days in 90 days ({Math.round(a.performance.baseline_pi * 100)}% of the model). {a.performance.hc_days} clear days used; cloudy and rainy days are left out.</li>
            <li>Dust: a steady slide of 5–30% since the last rain or cleaning. Fault: a sudden drop of 15% or more that stays. Healthy: 92% of normal or better.</li>
            {a.evidence.map((e, i) => <li key={i}>{e}</li>)}
            <li>Limits: one roof's readings; shade and panel age look alike to the numbers. Photos are a visual estimate only. Readings were read by Amazon Textract and confirmed by you.</li>
          </ul>
        </Section>

        {a.peers.n_peers > 0 && <Section title="Nearby roofs" summary={`${a.peers.n_peers} within ~5 km${a.peers_simulated ? ' · simulated' : ''}`} force={printing}>
          {a.peers_simulated && <Badge tone="sun" icon="info">Simulated neighbours (sample)</Badge>}
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend} margin={{ left: -16, right: 8 }}>
              <CartesianGrid {...grid} /><XAxis dataKey="d" {...axis} minTickGap={24} /><YAxis {...axis} domain={[60, 110]} />
              <Tooltip {...tooltip} formatter={(val) => `${val}%`} /><Legend {...legend} />
              <Line isAnimationActive={false} dataKey="you" name="You" stroke="var(--dust)" strokeWidth={2.5} dot={false} />
              <Line isAnimationActive={false} dataKey="peers" name="Neighbours (median)" stroke="var(--ink-2)" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Section>}
      </div>

      {(dusty || a.verdict === 'UNEXPLAINED') && <Cleaners view={view} analysis={a} analysisId={analysisId} sample={sample} />}

      <div className="report-actions no-print">
        <Button variant="secondary" icon="globe" onClick={share}>Save this report</Button>
        <Button variant="secondary" icon="upload" onClick={() => setPrinting(true)}>Download PDF</Button>
        {dusty && !sample && !mine.some((x) => x.type === 'CLEAN_PANELS') && a.allowed_actions[a.verdict]?.includes('CLEAN_PANELS') &&
          <Button variant="secondary" icon="history" disabled={busy} onClick={() => act('CLEAN_PANELS')}>Recheck after cleaning</Button>}
        {copied && <span className="muted small" role="status">{copied}</span>}
      </div>
    </div>
  )
}

