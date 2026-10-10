// Self-check for money.ts: node src/lib/money.check.ts
import assert from 'node:assert/strict'
import { bestInterval, breakEvenDays, project, type MoneyInputs } from './money.ts'

const base: MoneyInputs = { normalKwh: 14, lossNow: 0.12, dustRate: 0.0075, tariff: 6, cleaningCost: 200, today: '2026-10-10' }

// No dust, no loss.
assert.equal(project({ ...base, lossNow: 0, dustRate: 0 }, null).totalInr, 0)

// Cleaning at the best interval beats never cleaning, and the formula's N is near the brute-force optimum.
const n = bestInterval(base)!
assert.ok(project(base, n).totalInr < project(base, null).totalInr)
let bestN = 7, bestCost = Infinity
for (let k = 7; k <= 120; k++) { const c = project(base, k).totalInr; if (c < bestCost) { bestCost = c; bestN = k } }
assert.ok(project(base, n).totalInr <= bestCost * 1.05, `formula N=${n} vs brute ${bestN}`)

// Break-even: ₹200 / (0.12 × 14 × 6 = ₹10.08 a day) = 20 days.
assert.equal(breakEvenDays(base), 20)

// Monsoon months carry no dust loss.
const jul = project(base, null).months.find((m) => m.month === '2027-07')!
assert.equal(jul.lossInr, 0)

console.log(`money.ts ok: best interval ${n} days (brute force ${bestN}), never-clean ₹${project(base, null).totalInr}/yr`)
