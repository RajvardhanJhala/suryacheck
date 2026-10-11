// Where the sun is on its path right now in Ahmedabad: 0 at sunrise, 1 at sunset (clamped at night).
// Standard NOAA approximation (declination + equation of time); good to a few minutes, plenty for a logo.
// Self-check: node src/lib/sun.check.ts
const LAT = 23.03, LON = 72.58, IST = 5.5

export function sunTimes(date: Date): { rise: number; set: number } {   // hours, IST
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const doy = Math.floor((date.getTime() - start) / 86400000)
  const g = (2 * Math.PI / 365) * (doy - 1)
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
  const lat = LAT * Math.PI / 180
  const ha = Math.acos(Math.cos(90.833 * Math.PI / 180) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl)) * 180 / Math.PI
  const noon = (720 - 4 * LON - eqt) / 60 + IST
  return { rise: noon - ha / 15, set: noon + ha / 15 }
}

export function sunFraction(now = new Date()): number {
  const h = ((now.getUTCHours() + now.getUTCMinutes() / 60 + IST) % 24 + 24) % 24
  const { rise, set } = sunTimes(now)
  return Math.min(1, Math.max(0, (h - rise) / (set - rise)))
}
