export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Point on a semicircle of radius r centred at (cx, cy) at fraction t of the day (0 = sunrise). */
export function arcPoint(cx: number, cy: number, r: number, t: number) {
  const a = Math.PI * (1 - t)
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }
}

export const arcPath = (cx: number, cy: number, r: number) => `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
