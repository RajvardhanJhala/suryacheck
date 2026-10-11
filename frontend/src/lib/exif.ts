// GPS position from a JPEG's EXIF block: the fallback when the browser won't share location.
// Self-check: node src/lib/exif.check.ts

/** Decimal-degree position from the EXIF GPS tags, or null (no EXIF, no GPS, not a JPEG). */
export function gpsFromJpeg(buf: ArrayBuffer): { lat: number; lon: number } | null {
  try {
    const v = new DataView(buf)
    if (v.getUint16(0) !== 0xffd8) return null
    for (let off = 2; off + 10 < v.byteLength;) {
      const marker = v.getUint16(off)
      if ((marker & 0xff00) !== 0xff00) return null
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) return fromTiff(v, off + 10)    // "Exif"
      off += 2 + v.getUint16(off + 2)
    }
  } catch { /* truncated or malformed EXIF: no position */ }
  return null
}

function fromTiff(v: DataView, t: number) {
  const le = v.getUint16(t) === 0x4949
  const u16 = (o: number) => v.getUint16(t + o, le), u32 = (o: number) => v.getUint32(t + o, le)
  const entries = (ifd: number) => Array.from({ length: u16(ifd) }, (_, i) => ifd + 2 + i * 12)
  const gpsPtr = entries(u32(4)).find((e) => u16(e) === 0x8825)
  if (gpsPtr === undefined) return null
  const tag: Record<number, number> = {}
  for (const e of entries(u32(gpsPtr + 8))) tag[u16(e)] = e
  if (![1, 2, 3, 4].every((k) => k in tag)) return null
  const ref = (k: number) => String.fromCharCode(v.getUint8(t + tag[k] + 8))
  const deg = (k: number) => {
    const o = u32(tag[k] + 8), r = (i: number) => u32(o + i * 8) / u32(o + i * 8 + 4)
    return r(0) + r(1) / 60 + r(2) / 3600
  }
  const lat = deg(2) * (ref(1) === 'S' ? -1 : 1), lon = deg(4) * (ref(3) === 'W' ? -1 : 1)
  return Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? { lat, lon } : null
}
