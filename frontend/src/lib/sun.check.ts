// Self-check for sun.ts: node src/lib/sun.check.ts
import assert from 'node:assert/strict'
import { sunFraction, sunTimes } from './sun.ts'

// Ahmedabad, 11 Oct 2026: sunrise ~06:35, sunset ~18:20 IST.
const { rise, set } = sunTimes(new Date('2026-10-11T06:00:00Z'))
assert.ok(Math.abs(rise - 6.58) < 0.1 && Math.abs(set - 18.37) < 0.1, `${rise} ${set}`)
assert.equal(sunFraction(new Date('2026-10-10T20:00:00Z')), 0)        // 01:30 IST: night, at the sunrise end
assert.ok(Math.abs(sunFraction(new Date('2026-10-11T06:58:00Z')) - 0.5) < 0.05)   // ~12:28 IST: solar noon
assert.equal(sunFraction(new Date('2026-10-11T15:00:00Z')), 1)        // 20:30 IST: after sunset
console.log('sun.ts ok', rise.toFixed(2), set.toFixed(2))
