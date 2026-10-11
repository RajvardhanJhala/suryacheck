// Self-check for dustScene.ts: node src/site/dustScene.check.ts
import assert from 'node:assert/strict'
import { BUILD_MS, LOOP_MS, lostPerMonth, outputPct, sceneAt } from './dustScene.ts'

const end = sceneAt(BUILD_MS - 1)                     // last frame of the dry spell
assert.equal(outputPct(end.loss), 88)                  // 100% -> 88%
assert.equal(lostPerMonth(end.loss), 311)              // ₹0 -> ₹311
assert.equal(lostPerMonth(sceneAt(0).loss), 0)         // starts clean: ₹0, 100%
assert.equal(outputPct(sceneAt(0).loss), 100)
assert.equal(sceneAt(LOOP_MS - 1).loss, 0)             // washed at the end of each loop
assert.equal(sceneAt(0).ending, 'rain')
assert.equal(sceneAt(LOOP_MS).ending, 'clean')         // endings alternate
console.log('dustScene ok')
