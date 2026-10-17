import test from 'node:test'
import assert from 'node:assert/strict'
import {
  seed,
  attention,
  filterEntries,
  indicators,
  applyEvent,
  validateEntry,
  nextResourceId,
} from './domain.ts'

test('new resource never inherits an archived resource history', () => {
  const data = applyEvent(seed(), 'equipment', 12, 'failure')
  data.equipment = data.equipment.filter((e) => e.id !== 12)
  assert.equal(nextResourceId(data, 'equipment'), 13)
})

test('empty inventory has no fabricated availability', () =>
  assert.equal(indicators([]).availability, null))
test('filters operate on the same equipment list used by indicators', () => {
  const data = seed()
  const list = filterEntries(data.equipment, {
    search: 'DEMO-001',
    status: '',
    kind: '',
    region: '',
    agency: '',
  })
  assert.equal(list.length, 1)
  assert.equal(indicators(list).total, 1)
})
test('no telemetry does not penalize equipment', () => {
  const item = seed().equipment[1]
  item.maintenance = 'none'
  item.last_seen = null
  assert.equal(attention(item, []).score, 0)
})
test('simulated failure changes current state and leaves event history', () => {
  const state = seed()
  const item = state.equipment[0]
  const changed = applyEvent(state, 'equipment', item.id, 'failure')
  assert.equal(changed.equipment[0].status, 'fault')
  assert.equal(changed.equipment[0].maintenance, 'immediate')
  assert.equal(changed.events[0].kind, 'failure')
  assert.equal(state.equipment[0].status, 'operational')
})
test('validation rejects non-finite, blank and out-of-range coordinates', () => {
  const state = seed()
  const record = state.equipment[0]
  for (const value of ['NaN', 'Infinity', '', '91'])
    assert.ok(validateEntry({ ...record, latitude: value }, 'equipment', state.equipment).latitude)
})
test('score explains high attention without presenting probability', () => {
  const data = seed()
  const item = data.equipment[1]
  item.maintenance = 'immediate'
  item.last_seen = new Date(Date.now() - 31 * 60000).toISOString()
  const result = attention(item, [])
  assert.equal(result.score, 55)
  assert.equal(result.level, 'high')
  assert.equal(result.factors.length, 2)
})
