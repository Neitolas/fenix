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
    search: 'CAM-CENTRO-001',
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

test('demonstration rejects invalid characteristics just like Django', () => {
  const data = seed()
  for (const characteristics of [
    { night_vision: 'sim' },
    { speed_limit: true },
    { speed_limit: 201 },
    { speed_limit: 0 },
    [],
    null,
  ])
    assert.ok(
      validateEntry({ ...data.equipment[0], characteristics }, 'equipment', data.equipment)
        .characteristics,
    )
  for (const characteristics of [
    { night_vision: false },
    { speed_limit: 1 },
    { speed_limit: 200 },
    {},
  ])
    assert.equal(
      validateEntry({ ...data.equipment[0], characteristics }, 'equipment', data.equipment)
        .characteristics,
      undefined,
    )
})

test('examples use meaningful urban mobility identities', () => {
  const data = seed()
  assert.equal(data.equipment[0].serial, 'CAM-CENTRO-001')
  assert.equal(data.equipment[0].model, 'Sentinela 360 — Praça Central')
  assert.equal(data.agents[0].name, 'Ana Martins')
  assert.ok(
    data.events.every((e) =>
      data.equipment.some((item) => item.id === e.equipment && item.serial === e.resource_name),
    ),
  )
})
