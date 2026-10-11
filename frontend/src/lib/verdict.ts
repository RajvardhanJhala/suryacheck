// Verdict wording and the one loss definition, shared by the results page, cleaners and history.
import type { Analysis } from '../api'

export const DUSTY = ['SOILING', 'STEADY_LOSS']
export const LOSS_LABEL = 'Lost = units below what the sunshine allowed on clear days, at your electricity rate'
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
    case 'INSUFFICIENT_DATA': return `We need 7 clear days of readings to judge; we have ${a.performance.hc_days}. A screenshot of your inverter app's daily list adds them in one go.`
    default: return `Output is ${gap}% below what the sunshine allowed, but the cause isn't clear yet.`
  }
}
