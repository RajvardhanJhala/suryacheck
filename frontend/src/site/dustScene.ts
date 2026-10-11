// Timeline of the landing page's dust panel. Pure: time in, state out. Self-check: node src/site/dustScene.check.ts
import { soilingAfter } from '../lib/money.ts'

// The sample roof: 3 kWp in Ahmedabad makes 14.4 kWh a day when clean; ₹6/unit; dust costs 0.6% per dry day.
export const NORMAL_KWH = 14.4, TARIFF = 6, RATE = 0.006, DAYS = 20
export const MAX_LOSS = soilingAfter(0, RATE, DAYS)                     // 12% after 20 dry days
export const BUILD_MS = 10000, END_MS = 3000, HOLD_MS = 1000, LOOP_MS = BUILD_MS + END_MS + HOLD_MS

export const outputPct = (loss: number) => Math.round((1 - loss) * 100)
export const lostPerMonth = (loss: number) => Math.round(loss * NORMAL_KWH * TARIFF * 30)

export type Ending = 'rain' | 'clean'
/** The counter people read: Day 1 … Day 20. */
export const dayLabel = (s: Scene) => Math.min(DAYS, Math.max(1, Math.ceil(s.day)))

export type Scene = { phase: 'build' | 'end' | 'hold'; ending: Ending; day: number; loss: number; k: number }

/** k = progress through the current phase (0..1). Loops alternate between a rain and a cleaning ending. */
export function sceneAt(t: number): Scene {
  const ending: Ending = Math.floor(t / LOOP_MS) % 2 === 0 ? 'rain' : 'clean'
  const tt = t % LOOP_MS
  if (tt < BUILD_MS) {
    const day = DAYS * (tt / BUILD_MS)                   // dry days elapsed, 0 -> 20
    return { phase: 'build', ending, day, loss: soilingAfter(0, RATE, day), k: tt / BUILD_MS }
  }
  if (tt < BUILD_MS + END_MS) {
    const k = (tt - BUILD_MS) / END_MS
    return { phase: 'end', ending, day: DAYS, loss: MAX_LOSS * (1 - k), k }
  }
  return { phase: 'hold', ending, day: 0, loss: 0, k: (tt - BUILD_MS - END_MS) / HOLD_MS }
}

export function caption(s: Scene, wiped?: number): string {
  if (wiped !== undefined) return `You've wiped ${Math.round(wiped * 100)}% clean: ₹${lostPerMonth(s.loss)} a month still lost.`
  if (s.phase === 'build') {
    const d = dayLabel(s)
    return d <= 2 ? 'Freshly washed: the panels make what the sun allows.' : `Day ${d}: dust is settling, ${100 - outputPct(s.loss)}% of the sunshine wasted.`
  }
  if (s.phase === 'end') return s.ending === 'rain' ? 'Rain arrives and runs the dust off.' : 'A cleaning sweeps the dust away.'
  return s.ending === 'rain' ? 'Washed by rain: back to 100%. Until the next dry spell.' : 'Cleaned: back to 100%, ₹0 lost.'
}
