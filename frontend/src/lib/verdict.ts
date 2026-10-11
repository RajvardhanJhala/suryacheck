// Verdict wording and the one loss definition, shared by the results page, cleaners and history.
import type { Analysis } from '../api'

export const DUSTY = ['SOILING', 'STEADY_LOSS']
/** Fewer than 7 clear days: a quick check against the physics estimate, no history yet. */
export const isQuick = (a: Analysis) => a.performance.hc_days < 7
export const LOSS_LABEL = 'Lost = units below what the sunshine allowed on clear days, at your electricity rate'
export const shortDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
export const todayIST = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)

/** One plain sentence, built only from computed numbers. */
export function verdictSentence(a: Analysis): string {
  const pr = a.performance.med3_latest
  const gap = pr == null ? 0 : Math.max(0, Math.round((1 - pr) * 100))
  switch (a.verdict) {
    case 'HEALTHY': return `Your panels made ${Math.round(Math.min(pr ?? 1, 1) * 100)}% of what the sunshine allowed. Nothing to do.`
    case 'SOILING': return `Your panels made ${gap}% less than the sunshine allowed, most likely dust.`
    case 'STEADY_LOSS': return `Your panels have made ${gap}% less than the sunshine allowed for weeks: dust or new shade.`
    case 'FAULT': return 'Output dropped suddenly and stayed down. That points to an electrical fault, not dust.'
    case 'INVERTER_TRIP': return 'On sunny days your system made almost nothing. Check the inverter screen for an error.'
    case 'WEATHER': return 'Nearby roofs dipped by the same amount, so this is the weather, not your panels.'
    case 'PERSISTENT_LOW': return `Your system has made about ${Math.round((a.performance.med14_abs_pi ?? 0) * 100)}% of the physics estimate for weeks. Check the size on your papers, or new shade.`
    case 'BELOW_EXPECTED': {
      const d = a.latest_day
      return d ? `On ${shortDay(d.date)} your panels made ${d.actual} kWh; the sunshine allowed ${d.expected}. That's ₹${d.loss_inr} lost that day. Dust is the usual cause; adding more days can tell it from a fault.`
        : `Your panels made ${gap}% less than the sunshine allowed.`
    }
    case 'INSUFFICIENT_DATA': return a.latest_day?.cloudy
      ? `${shortDay(a.latest_day.date)} was too cloudy to judge. Add a sunny day's reading.`
      : "Add at least one sunny day's reading to check your roof."
    default: return `Output is ${gap}% below what the sunshine allowed, but the cause isn't clear yet.`
  }
}
