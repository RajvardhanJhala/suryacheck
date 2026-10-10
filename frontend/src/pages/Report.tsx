import { useCallback, useEffect, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { api, type Action, type Analysis, type SiteView } from '../api'
import { go } from '../LegacyApp'
import { ACTION_LABEL, TONE, VERDICT_LABEL, inr, shortDate, todayIST } from '../format'

const NO_LOSS = new Set(['HEALTHY', 'WEATHER', 'INSUFFICIENT_DATA'])

export default function Report({ siteId }: { siteId: string }) {
  const [view, setView] = useState<SiteView | null>(null)
  const [a, setA] = useState<Analysis | null>(null)
  const [aid, setAid] = useState<string | null>(null)
  const [wait, setWait] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setErr('')
    try {
      const v = await api.getSite(siteId)
      setView(v)
      if (!v.latestAnalysisId) return
      setAid(v.latestAnalysisId)
      setWait(0)
      setA(await api.waitForAnalysis(siteId, v.latestAnalysisId, setWait))
    } catch (e) { setErr((e as Error).message) } finally { setWait(null) }
  }, [siteId])

  useEffect(() => { load() }, [load])

  const rerun = async () => {
    setBusy(true)
    try { await api.startAnalysis(siteId); await load() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const act = async (action: string) => {
    if (!aid) return
    setBusy(true); setErr('')
    try {
      const res = await api.createAction(siteId, aid, action)
      if (res.whatsapp_url) window.open(res.whatsapp_url, '_blank', 'noopener')
      setView((v) => v && { ...v, actions: [...v.actions.filter((x) => x.recheck_at !== res.recheck_at), { ...res }] })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const logCleaning = async () => {
    setBusy(true)
    try { await api.addEvent(siteId, todayIST(), 'CLEANED'); await load() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  if (err && !view) return <div className="panel"><p className="error">{err}</p><button className="btn" onClick={() => go('')}>Home</button></div>
  if (!view) return <p className="status center"><span className="spinner" /> Loading…</p>

  const sim = !!view.site.simulated
  const mine = view.actions.filter((x) => (x as { analysis_id?: string }).analysis_id === aid || x.actionId)
  const actionDone = mine.find((x) => x.type === a?.action)

  return (
    <div className="report">
      <div className="report-head">
        <div>
          <h1>{view.site.label ?? 'My roof'}</h1>
          <p className="muted small">{view.site.capacity_kwp} kW rooftop · {a ? `report as of ${shortDate(a.as_of)}` : 'no report yet'}</p>
        </div>
        {sim && <span className="badge sim">Simulated</span>}
      </div>

      {wait !== null && <p className="status"><span className="spinner" aria-hidden /> Comparing your units with the real sunshine… {wait > 0 && `${wait}s`}</p>}
      {!view.latestAnalysisId && (
        <div className="panel"><p>No check yet.</p>
          <button className="btn primary" onClick={() => go(`site/${siteId}/add`)}>Add your daily units</button></div>
      )}
      {a?.status === 'FAILED' && <p className="error">The check failed: {a.error}</p>}

      {a?.status === 'DONE' && (
        <>
          <section className={`verdict tone-${TONE[a.verdict] ?? 'info'}`}>
            <span className="chip">{VERDICT_LABEL[a.verdict] ?? a.verdict}</span>
            {!NO_LOSS.has(a.verdict) && a.monthly_loss_inr > 0 && (
              <p className="money"><span>{inr(a.monthly_loss_inr)}</span> lost per month</p>
            )}
            <h2>{a.explanation.headline}</h2>
            {a.explanation.why && <p>{a.explanation.why}</p>}
            <p className="todo"><b>What to do:</b> {a.explanation.what_to_do}</p>

            {a.action !== 'NONE' && a.action !== 'ADD_DATA' && !actionDone && (
              <button className="btn primary block big" onClick={() => act(a.action)} disabled={busy}>
                {ACTION_LABEL[a.action] ?? a.action}
              </button>
            )}
            {a.action === 'ADD_DATA' && !sim && (
              <button className="btn primary block" onClick={() => go(`site/${siteId}/add`)}>Add more days</button>
            )}
          </section>

          {mine.map((x, i) => <RecheckCard key={i} action={x} />)}

          <section className="panel">
            <h3>Your units vs. what the sunshine allowed</h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={a.series.map((p) => ({ ...p, d: shortDate(p.date) }))} margin={{ left: -18, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} unit="" />
                <Tooltip formatter={(v) => (typeof v === 'number' ? `${v.toFixed(1)} kWh` : v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar isAnimationActive={false} dataKey="actual" name="Your units" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                <Line isAnimationActive={false} dataKey="expected" name="Sunshine allowed" stroke="var(--ink)" strokeDasharray="5 4" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
            {a.peers.n_peers > 0 && (
              <>
                <h3>You vs. your neighbours (% of normal)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={a.series.filter((p) => p.pi_norm != null).map((p) => ({
                    d: shortDate(p.date), you: Math.round((p.pi_norm ?? 0) * 100),
                    peers: p.peer_pi_norm == null ? null : Math.round(p.peer_pi_norm * 100) }))} margin={{ left: -18, right: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey="d" tick={{ fontSize: 11 }} minTickGap={24} />
                    <YAxis domain={[60, 110]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line isAnimationActive={false} dataKey="you" name="You" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
                    <Line isAnimationActive={false} dataKey="peers" name={`Neighbours (${a.peers.n_peers}${a.peers_simulated ? ', simulated' : ''})`}
                      stroke="var(--muted)" strokeWidth={2} dot={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            )}
            <details>
              <summary>How we worked this out</summary>
              <ul className="small">
                <li>Expected units come from real hourly sunshine and temperature for your roof (Open-Meteo), run through the pvlib solar model.</li>
                <li>“Normal” is your own best week in the last 90 days ({Math.round(a.performance.baseline_pi * 100)}% of the model).</li>
                <li>Cloudy and rainy days are left out of the verdict because the weather model is least reliable then.</li>
                {a.evidence.map((e, i) => <li key={i}>{e}</li>)}
                <li>Explanation written by: {a.explanation_source === 'template' ? 'SuryaCheck rules' : 'AI (numbers from rules)'}.</li>
              </ul>
            </details>
          </section>
        </>
      )}

      {err && <p className="error">{err}</p>}
      {!sim && (
        <div className="row wrap">
          <button className="btn" onClick={() => go(`site/${siteId}/add`)}>Add more days</button>
          <button className="btn" onClick={logCleaning} disabled={busy}>I cleaned the panels today</button>
          <button className="btn" onClick={rerun} disabled={busy}>Run the check again</button>
        </div>
      )}
      {sim && <p className="hint center">Demo home: read-only. <a href="#/new">Check your own roof →</a></p>}
    </div>
  )
}

function RecheckCard({ action }: { action: Action }) {
  const r = action.recheck_result
  if (action.outcome === 'RECOVERED' && r) {
    return (
      <section className="verdict tone-good">
        <span className="chip">Recheck ✓</span>
        <p className="money"><span>{inr(r.recovered_inr_month)}</span> per month recovered</p>
        <p>After the cleaning, output went from {Math.round((r.pre_pi_norm ?? 0) * 100)}% to
          {' '}{Math.round(Math.min(1, r.post_pi_norm ?? 0) * 100)}% of normal, measured against the same yardstick as before.</p>
        {r.series && r.series.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={r.series.map((p) => ({ ...p, d: shortDate(p.date) }))} margin={{ left: -18, right: 4, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="d" tick={{ fontSize: 11 }} minTickGap={20} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => (typeof v === 'number' ? `${v.toFixed(1)} kWh` : v)} />
              <Bar isAnimationActive={false} dataKey="actual" name="Your units" fill="var(--good)" radius={[3, 3, 0, 0]} />
              <Line isAnimationActive={false} dataKey="expected" name="Normal for the sunshine" stroke="var(--ink)"
                strokeDasharray="5 4" dot={false} strokeWidth={2} />
              {r.cleaned_on && <ReferenceLine x={shortDate(r.cleaned_on)} stroke="var(--good)" strokeWidth={2}
                label={{ value: 'Cleaned', position: 'insideTopRight', fontSize: 11, fill: 'var(--good)' }} />}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </section>
    )
  }
  if (action.outcome === 'NOT_RECOVERED') {
    return (
      <section className="verdict tone-bad">
        <span className="chip">Recheck ✗</span>
        <h2>Cleaning didn't bring the units back — it isn't dust.</h2>
        <p className="todo"><b>What to do:</b> send the evidence to your installer.</p>
      </section>
    )
  }
  if (action.outcome === 'PENDING' || action.outcome === 'WAITING_FOR_DATA') {
    return (
      <section className="panel recheck">
        <p>⏱ {action.outcome === 'WAITING_FOR_DATA' ? 'Waiting for a few more days of units. ' : ''}
          SuryaCheck will recheck {action.recheck_at ? `around ${new Date(action.recheck_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'soon'}
          {' '}and tell you whether the money came back.</p>
      </section>
    )
  }
  return null
}
