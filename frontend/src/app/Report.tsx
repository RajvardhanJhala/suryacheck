import { useState } from 'react'
import { Link } from 'react-router'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type Action } from '../api'
import { confidence, diagnosisText, VERDICT, type Lang } from '../lib/i18n'
import { usePageMeta } from '../lib/seo'
import { axis, grid, legend, shortDate, tooltip } from '../ui/charts'
import { Icon } from '../ui/icons'
import { Badge, Button, Card, Notice, Reading } from '../ui/primitives'
import { useSite } from './siteContext'
import { Screen } from './States'
import { PhotoResult } from './NewCheck'

const ACTION_LABEL: Record<string, string> = {
  CLEAN_PANELS: 'Ask a cleaner on WhatsApp', MESSAGE_INSTALLER: 'Send the evidence to my installer',
  CHECK_INVERTER_DISPLAY: 'I checked the inverter', INSPECT_SHADING: "I'll check for new shade",
  VERIFY_CAPACITY: "I'll check my papers", WAIT: 'OK — check again next week',
}

function Recheck({ action }: { action: Action }) {
  const r = action.recheck_result
  if (action.outcome === 'RECOVERED' && r) return (
    <Card className="recheck is-clean">
      <Badge tone="clean" icon="check">Recheck · recovered</Badge>
      <p className="recheck-money"><Reading value={r.recovered_inr_month ?? 0} prefix="₹" tone="clean" /> per month recovered</p>
      <p>After the cleaning, output went from {Math.round((r.pre_pi_norm ?? 0) * 100)}% to {Math.round(Math.min(1, r.post_pi_norm ?? 0) * 100)}% of
        normal — measured against the same yardstick as before.</p>
      {r.series && <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={r.series.map((p) => ({ ...p, d: shortDate(p.date) }))} margin={{ left: -16, right: 8, top: 8 }}>
          <CartesianGrid {...grid} /><XAxis dataKey="d" {...axis} minTickGap={20} /><YAxis {...axis} />
          <Tooltip {...tooltip} formatter={(v) => (typeof v === 'number' ? `${v.toFixed(1)} kWh` : v)} />
          <Bar isAnimationActive={false} dataKey="actual" name="Your units" fill="var(--clean)" radius={[3, 3, 0, 0]} />
          <Line isAnimationActive={false} dataKey="expected" name="Normal" stroke="var(--ink)" strokeDasharray="5 4" dot={false} strokeWidth={2} />
          {r.cleaned_on && <ReferenceLine x={shortDate(r.cleaned_on)} stroke="var(--clean)" strokeWidth={2}
            label={{ value: 'Cleaned', position: 'insideTopRight', fontSize: 11, fill: 'var(--clean)' }} />}
        </ComposedChart>
      </ResponsiveContainer>}
    </Card>
  )
  if (action.outcome === 'NOT_RECOVERED') return (
    <Notice tone="fault" title="Cleaning didn't bring the units back — it isn't dust.">Send the evidence to your installer.</Notice>
  )
  if (action.outcome === 'PENDING' || action.outcome === 'WAITING_FOR_DATA') return (
    <Notice tone="info" title="Recheck scheduled">
      {action.outcome === 'WAITING_FOR_DATA' ? 'Waiting for a few more days of units. ' : ''}SuryaCheck rechecks around{' '}
      {action.recheck_at ? new Date(action.recheck_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'soon'} and
      tells you whether the money came back (Amazon EventBridge Scheduler).
    </Notice>
  )
  return null
}

export default function Report() {
  usePageMeta('Report')
  const { analysis: a, analysisId, view, siteId, sample, base, reload } = useSite()
  const [lang, setLang] = useState<Lang>(view?.site.language === 'hi' ? 'hi' : 'en')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const act = async (type: string) => {
    if (!siteId || !analysisId) return
    setBusy(true); setErr('')
    try {
      const r = await api.createAction(siteId, analysisId, type)
      if (r.whatsapp_url) window.open(r.whatsapp_url, '_blank', 'noopener')
      await reload()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Screen title="Report">
      {a && view && (() => {
        const v = VERDICT[a.verdict] ?? VERDICT.UNEXPLAINED
        const t = diagnosisText(a, lang)
        const conf = confidence(a)
        const mine = view.actions.filter((x) => (x as { analysis_id?: string }).analysis_id === analysisId)
        const done = mine.some((x) => x.type === a.action)
        const series = a.series.map((p) => ({ ...p, d: shortDate(p.date),
          you: p.pi_norm == null ? null : Math.round(p.pi_norm * 100), peers: p.peer_pi_norm == null ? null : Math.round(p.peer_pi_norm * 100) }))
        return (
          <div className="report">
            <header className="screen-head">
              <div><p className="eyebrow">Soiling analysis · as of {shortDate(a.as_of)}</p><h1>Report</h1></div>
              <div className="lang-toggle" role="group" aria-label="Language">
                <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
                <button aria-pressed={lang === 'hi'} onClick={() => setLang('hi')} lang="hi">हिंदी</button>
              </div>
            </header>

            <Card className={`diagnosis tone-${v.tone}`}>
              <div className="row">
                <Badge tone={v.tone} icon={v.tone === 'clean' ? 'check' : v.tone === 'fault' ? 'bolt' : v.tone === 'dust' ? 'dust' : 'info'}>{v[lang]}</Badge>
                {conf && <Badge>{conf} confidence</Badge>}
                {a.tie_candidates?.length > 0 && <Badge>Close call: {a.tie_candidates.map((c) => VERDICT[c]?.en).join(' or ')}</Badge>}
              </div>
              <h2 lang={lang}>{t.headline}</h2>
              {t.why && <p lang={lang}>{t.why}</p>}
              <p lang={lang}><strong>{lang === 'hi' ? 'क्या करें:' : 'What to do:'}</strong> {t.what_to_do}</p>
              {a.monthly_loss_inr > 0 && <p className="diag-money"><Reading value={a.monthly_loss_inr} prefix="₹" tone="dust" /> <span className="muted">lost per month at today's rate</span></p>}
              <div className="row">
              {ACTION_LABEL[a.action] && !done && <Button icon={a.action === 'CLEAN_PANELS' || a.action === 'MESSAGE_INSTALLER' ? 'chat' : 'check'} disabled={busy} onClick={() => act(a.action)}>{ACTION_LABEL[a.action]}</Button>}
              {a.action === 'CLEAN_PANELS' && <Link className="btn btn-secondary" to={`${base}/clean${sample ? `?site=${siteId}` : ''}`}><Icon name="pin" size={18} />Find a cleaner nearby</Link>}
              </div>
              {err && <Notice tone="fault" title={err} />}
            </Card>

            {mine.map((x, i) => <Recheck key={i} action={x} />)}

            <Card>
              <h2 className="h3">Your units vs what the sunshine allowed</h2>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={series} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid {...grid} /><XAxis dataKey="d" {...axis} minTickGap={24} /><YAxis {...axis} unit="" />
                  <Tooltip {...tooltip} formatter={(val) => (typeof val === 'number' ? `${val.toFixed(1)} kWh` : val)} />
                  <Legend {...legend} />
                  <Bar isAnimationActive={false} dataKey="actual" name="Your units (kWh)" fill="var(--sun)" radius={[3, 3, 0, 0]} />
                  <Line isAnimationActive={false} dataKey="expected" name="Sunshine allowed" stroke="var(--ink)" strokeDasharray="5 4" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            <div className="two">
              <Card>
                <h2 className="h3">Performance trend</h2>
                <p className="muted small">% of your normal on clear days. Below 92% means something is costing you.</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={series.filter((p) => p.you != null)} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid {...grid} /><XAxis dataKey="d" {...axis} minTickGap={24} /><YAxis {...axis} domain={[60, 110]} />
                    <Tooltip {...tooltip} formatter={(val) => `${val}%`} />
                    <ReferenceLine y={92} stroke="var(--clean)" strokeDasharray="4 4" label={{ value: 'healthy', position: 'insideTopLeft', fontSize: 11, fill: 'var(--clean)' }} />
                    <Line isAnimationActive={false} dataKey="you" name="You" stroke="var(--dust)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <h2 className="h3">You vs nearby systems</h2>
                {a.peers.n_peers > 0 ? <>
                  <p className="muted small">{a.peers.n_peers} systems within ~5 km{a.peers_simulated ? ' (simulated neighbours in this sample)' : ''}. If everyone dips, it's the weather.</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={series.filter((p) => p.you != null)} margin={{ left: -16, right: 8 }}>
                      <CartesianGrid {...grid} /><XAxis dataKey="d" {...axis} minTickGap={24} /><YAxis {...axis} domain={[60, 110]} />
                      <Tooltip {...tooltip} formatter={(val) => `${val}%`} /><Legend {...legend} />
                      <Line isAnimationActive={false} dataKey="you" name="You" stroke="var(--dust)" strokeWidth={2.5} dot={false} />
                      <Line isAnimationActive={false} dataKey="peers" name="Neighbours (median)" stroke="var(--ink-2)" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </> : <p className="muted">No nearby SuryaCheck systems yet. The diagnosis uses physics and your own history only.</p>}
              </Card>
            </div>

            <Card>
              <h2 className="h3">Panel photos</h2>
              {view.panelPhotos?.length ? (
                <div className="photos">{view.panelPhotos.map((p) => (
                  <figure key={p.url} className="photo">
                    <img src={p.url} alt={`Panel photo taken ${new Date(p.taken).toLocaleDateString('en-IN')}`} loading="lazy" />
                    {p.classification && <ul className="seen"><PhotoResult cls={p.classification} note="" /></ul>}
                  </figure>
                ))}</div>
              ) : <p className="muted">No panel photos with this check. Use the smart camera in New check.</p>}
              <Notice tone="info" title="Visual check: an estimate, never the verdict">Photos are checked by an open image model (CLIP, run on
                our own AWS Lambda) and by Amazon Rekognition. A condition is shown only when the model is confident; the dust verdict above
                always comes from your measured output.</Notice>
            </Card>

            <details className="card method">
              <summary>How this was worked out</summary>
              <ul className="small">
                <li>Expected units: Open-Meteo hourly weather for your roof → pvlib (Hay–Davies, Faiman, PVWatts).</li>
                <li>“Normal” = your best 7 clear days in 90 days ({Math.round(a.performance.baseline_pi * 100)}% of the model).</li>
                <li>{a.performance.hc_days} clear days used; cloudy and rainy days excluded from the verdict.</li>
                {a.evidence.map((e, i) => <li key={i}>{e}</li>)}
                <li>Text written by: {a.explanation_source === 'template' ? 'SuryaCheck rules (no AI)' : 'AI from rule outputs'}.</li>
              </ul>
            </details>
          </div>
        )
      })()}
    </Screen>
  )
}
