// Self-check for exif.ts: node src/lib/exif.check.ts <geotagged.jpg> <plain.jpg>
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gpsFromJpeg } from './exif.ts'

const buf = (p: string) => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }
const g = gpsFromJpeg(buf(process.argv[2]))!
assert.ok(Math.abs(g.lat - 23.03) < 1e-6 && Math.abs(g.lon - 72.58) < 1e-6, JSON.stringify(g))
assert.equal(gpsFromJpeg(buf(process.argv[3])), null)
assert.equal(gpsFromJpeg(new ArrayBuffer(4)), null)
console.log('exif.ts ok', g)
