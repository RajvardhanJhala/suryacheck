import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import { ASSUMPTIONS, bestInterval, breakEvenDays, historicMonthly, inputsFromAnalysis, LOSS_CAP, project } from '../lib/money'
import { usePageMeta } from '../lib/seo'
import { axis, grid, legend, monthLabel, tooltip } from '../ui/charts'
import { Badge, Button, Card, Field, Notice, Reading } from '../ui/primitives'
import { useSite } from './siteContext'
import { Screen } from './States'

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

function MoneyView() {
  const { analysis: a, view, sample, reload } = useSite()
  const [tariff, setTariff] = useState(String(view?.site.tariff_inr ?? 6))
  const [cost, setCost] = useState(String(view?.site.cleaning_cost_inr ?? 200))
  const [saved, setSaved] = useState('')
  const T = Math.max(0, +tariff || 0), C = Math.max(0, +cost || 0)

  const save = async () => {
    if (!view) return
    try { await api.updateSite(view.siteId, { ...view.site, tariff_inr: T, cleaning_cost_inr: C }); setSaved('Saved'); reload() }
    catch (e) { setSaved((e as Error).message) }
  }

  return (
    <>
      {a && view && (() => {
        const inp = inputsFromAnalysis(a, T, C)
        const n = bestInterval(inp)
        const wait = project(inp, null)
        const clean = n ? project(inp, n) : null
        const be = breakEvenDays(inp)
        const hist = historicMonthly(a.series, T)
        const months = wait.months.map((m, i) => ({ m: monthLabel(m.month), wait: m.lossInr,
          clean: clean ? clean.months[i].lossInr + clean.months[i].costInr : null }))
        return (
          <div className="money">
            <header className="screen-head"><div><p className="eyebrow">Money and projections</p><h1>Money</h1></div><Badge>Estimates</Badge></header>

            <div className="money-top">
              <Card>
                <p className="eyebrow">Losing now</p>
                {/* Same run-rate as Overview/Report (backend), rescaled only if you change the tariff. */}
                <Reading value={Math.round(a.monthly_loss_inr * T / (view.site.tariff_inr || T || 1))} prefix="₹" tone={a.monthly_loss_inr > 0 ? 'dust' : 'clean'} />
                <p className="muted small">per month at today's rate</p>
              </Card>
              <Card>
                <p className="eyebrow">Next 12 months if you wait</p>
                <Reading value={wait.totalInr} prefix="₹" tone="dust" />
                <p className="muted small">dust builds up until the monsoon</p>
              </Card>
              <Card>
                <p className="eyebrow">Cleaning every {n ?? '—'} days</p>
                <Reading value={clean?.totalInr ?? 0} prefix="₹" tone="clean" />
                <p className="muted small">{clean ? `${clean.months.reduce((t, m) => t + m.cleanings, 0)} cleanings + remaining loss` : 'no dust build-up measured'}</p>
              </Card>
            </div>

            <div className="two">
              <Card>
                <h2 className="h3">Clean now vs keep waiting</h2>
                {clean ? <>
                  <p className="big-claim">Cleaning saves about <strong className="reading md is-clean">{inr(wait.totalInr - clean.totalInr)}</strong> over 12 months.</p>
                  <dl className="facts">
                    <div><dt>Recommended interval</dt><dd className="reading md">{n}<small>days</small></dd></div>
                    <div><dt>Today's cleaning pays for itself in</dt><dd className="reading md">{be ?? '—'}<small>days</small></dd></div>
                  </dl>
                </> : <Notice tone="clean" title="No dust build-up measured">Nothing to gain from cleaning right now.</Notice>}
              </Card>
              <Card>
                <h2 className="h3">Your numbers</h2>
                <Field id="tariff" label="Electricity rate (₹ per unit)" inputMode="decimal" value={tariff} onChange={(e) => setTariff(e.target.value)} hint="From your bill. Projections update as you type." />
                <Field id="cost" label="One cleaning costs (₹)" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
                {!sample && <Button variant="secondary" onClick={save}>Save to my system</Button>}{saved && <span className="muted small"> {saved}</span>}
              </Card>
            </div>

            <Card>
              <h2 className="h3">Next 12 months, month by month</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={months} margin={{ left: -4, right: 8 }}>
                  <CartesianGrid {...grid} /><XAxis dataKey="m" {...axis} /><YAxis {...axis} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip {...tooltip} formatter={(v) => inr(Number(v))} /><Legend {...legend} />
                  <Bar isAnimationActive={false} dataKey="wait" name="Keep waiting (dust loss)" fill="var(--dust)" radius={[3, 3, 0, 0]} />
                  {clean && <Bar isAnimationActive={false} dataKey="clean" name={`Clean every ${n} days (loss + cleaning)`} fill="var(--clean)" radius={[3, 3, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {hist.length > 0 && <Card>
              <h2 className="h3">Already lost (from your readings)</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hist.map((h) => ({ m: monthLabel(h.month), inr: h.lossInr }))} margin={{ left: -4, right: 8 }}>
                  <CartesianGrid {...grid} /><XAxis dataKey="m" {...axis} /><YAxis {...axis} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip {...tooltip} formatter={(v) => inr(Number(v))} />
                  <Bar isAnimationActive={false} dataKey="inr" name="Lost" fill="var(--dust)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="muted small">Partial months only count days you entered.</p>
            </Card>}

            <details className="card method" open>
              <summary>Formulas and assumptions</summary>
              <pre className="formula">{`normal units per day  E = ${inp.normalKwh.toFixed(1)} kWh   (expected × your best week)
dust rate             s = ${(inp.dustRate * 100).toFixed(2)}% per dry day   (slope since ${a.performance.segment_start})
loss tomorrow         L ← min(${LOSS_CAP * 100}%, L + s);  ₹ per day = L × E × ₹${T}
best interval         N = √(2 × ₹${C} ÷ (s × E × ₹${T})) = ${n ?? '—'} days
break-even            ₹${C} ÷ (today's loss × E × ₹${T}) = ${be ?? '—'} days`}</pre>
              <ul className="small">{ASSUMPTIONS.map((x) => <li key={x}>{x}</li>)}</ul>
            </details>
          </div>
        )
      })()}
    </>
  )
}

export default function Money() {
  usePageMeta('Money')
  const { view } = useSite()
  return <Screen title="Money"><MoneyView key={view?.siteId ?? 'none'} /></Screen>
}
