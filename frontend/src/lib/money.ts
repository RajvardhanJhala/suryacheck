// Money projections. Pure functions; every assumption is listed in ASSUMPTIONS and shown in the UI.
// Self-check: node src/lib/money.check.ts

export type MoneyInputs = {
  normalKwh: number   // what the roof makes per day when clean (expected × your normal)
  lossNow: number     // fraction lost today (1 − % of normal)
  dustRate: number    // fraction of output lost per dry day (soiling slope)
  tariff: number      // ₹ per kWh
  cleaningCost: number
  today: string       // YYYY-MM-DD
}

export const LOSS_CAP = 0.3
export const ASSUMPTIONS = [
  'Dust keeps building at the rate measured since your last rain or cleaning, up to 30% loss.',
  'Monsoon rain (15 Jun – 15 Sep) washes the panels, so no loss builds up then.',
  'Each day is valued at your normal daily units × your tariff; seasonal sunshine changes are ignored.',
  'A cleaning brings output back to your normal.',
]

const isMonsoon = (d: Date) => {
  const m = d.getMonth() + 1, day = d.getDate()
  return (m === 6 && day >= 15) || m === 7 || m === 8 || (m === 9 && day <= 15)
}

export type MonthRow = { month: string; lossInr: number; cleanings: number; costInr: number }

/** Simulate 365 days. cleanEvery = null means never clean; otherwise clean today and every N dry days. */
export function project(inp: MoneyInputs, cleanEvery: number | null): { months: MonthRow[]; totalInr: number } {
  const months = new Map<string, MonthRow>()
  let loss = cleanEvery === null ? inp.lossNow : 0
  let sinceClean = 0
  const start = new Date(inp.today + 'T00:00:00')
  for (let i = 0; i < 365; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 7)
    const row = months.get(key) ?? { month: key, lossInr: 0, cleanings: 0, costInr: 0 }
    if (cleanEvery !== null && i === 0) { row.cleanings++; row.costInr += inp.cleaningCost }
    if (isMonsoon(d)) { loss = 0; sinceClean = 0 } else {
      if (cleanEvery !== null && sinceClean >= cleanEvery) { loss = 0; sinceClean = 0; row.cleanings++; row.costInr += inp.cleaningCost }
      row.lossInr += loss * inp.normalKwh * inp.tariff
      loss = Math.min(LOSS_CAP, loss + inp.dustRate)
      sinceClean++
    }
    months.set(key, row)
  }
  const rows = [...months.values()].map((r) => ({ ...r, lossInr: Math.round(r.lossInr) }))
  return { months: rows, totalInr: rows.reduce((t, r) => t + r.lossInr + r.costInr, 0) }
}

/** Cleaning interval that minimises (cleaning cost + dust loss): N* = √(2·C / (s·E·T)). */
export function bestInterval(inp: MoneyInputs): number | null {
  const perDay = inp.dustRate * inp.normalKwh * inp.tariff
  if (perDay <= 0) return null
  return Math.round(Math.min(120, Math.max(7, Math.sqrt((2 * inp.cleaningCost) / perDay))))
}

/** Days until the money saved by cleaning today pays for the cleaning (ignores re-soiling: conservative). */
export function breakEvenDays(inp: MoneyInputs): number | null {
  const savedPerDay = inp.lossNow * inp.normalKwh * inp.tariff
  return savedPerDay > 0 ? Math.ceil(inp.cleaningCost / savedPerDay) : null
}

/** Historic ₹ lost per calendar month from the analysis series (days with a reading only). */
export function historicMonthly(series: { date: string; actual: number | null; expected: number }[], tariff: number) {
  const m = new Map<string, number>()
  for (const p of series) {
    if (p.actual == null) continue
    const k = p.date.slice(0, 7)
    m.set(k, (m.get(k) ?? 0) + Math.max(0, p.expected - p.actual) * tariff)
  }
  return [...m.entries()].map(([month, inr]) => ({ month, lossInr: Math.round(inr) }))
}

/** Inputs from an analysis: normal = expected × your best week; dust rate = slope since last rain/cleaning. */
export function inputsFromAnalysis(a: { as_of: string; performance: { mean_expected_kwh: number; baseline_pi: number;
  med3_latest: number | null; segment_slope: number | null } }, tariff: number, cleaningCost: number): MoneyInputs {
  const p = a.performance
  return {
    normalKwh: p.mean_expected_kwh * p.baseline_pi,
    lossNow: Math.max(0, 1 - (p.med3_latest ?? 1)),
    dustRate: Math.max(0, -(p.segment_slope ?? 0)),
    tariff, cleaningCost, today: a.as_of,
  }
}
