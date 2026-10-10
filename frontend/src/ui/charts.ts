// Recharts themed with brand tokens: mono tabular ticks, hairline grid, surface tooltip.
export const axis = {
  tick: { fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--ink-2)' },
  stroke: 'var(--line)',
  tickLine: false,
}
export const grid = { stroke: 'var(--line)', strokeDasharray: '2 4', vertical: false }
export const tooltip = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
    boxShadow: 'var(--sh-2)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' },
  labelStyle: { color: 'var(--ink-2)', marginBottom: 4 },
  cursor: { fill: 'var(--sunken)' },
}
export const legend = { wrapperStyle: { fontFamily: 'var(--font-text)', fontSize: 12, color: 'var(--ink-2)' } }
export const shortDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
export const monthLabel = (ym: string) => new Date(ym + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
