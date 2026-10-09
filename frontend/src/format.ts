export const inr = (n: number | null | undefined) =>
  '₹' + Math.round(n ?? 0).toLocaleString('en-IN')

export const shortDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export const todayIST = () =>
  new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)

export const VERDICT_LABEL: Record<string, string> = {
  SOILING: 'Dust', FAULT: 'Possible fault', INVERTER_TRIP: 'Inverter trip', WEATHER: 'Weather',
  PERSISTENT_LOW: 'Always low', STEADY_LOSS: 'Steady loss', UNEXPLAINED: 'Unclear', HEALTHY: 'Healthy',
  INSUFFICIENT_DATA: 'Need more data',
}

export const ACTION_LABEL: Record<string, string> = {
  CLEAN_PANELS: 'Ask a cleaner on WhatsApp',
  MESSAGE_INSTALLER: 'Send evidence to installer',
  CHECK_INVERTER_DISPLAY: 'I checked the inverter',
  INSPECT_SHADING: 'I will check for shade',
  VERIFY_CAPACITY: 'I will check my papers',
  WAIT: 'OK, check again next week',
}

export const TONE: Record<string, 'bad' | 'warn' | 'good' | 'info'> = {
  SOILING: 'warn', FAULT: 'bad', INVERTER_TRIP: 'bad', WEATHER: 'info', PERSISTENT_LOW: 'warn',
  STEADY_LOSS: 'warn', UNEXPLAINED: 'warn', HEALTHY: 'good', INSUFFICIENT_DATA: 'info',
}
