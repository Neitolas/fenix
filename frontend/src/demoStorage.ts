import catalog from '../../backend/operations/demo_catalog.json' with { type: 'json' }
import { seed, validateEntry } from './domain'
import { emptyEntry } from './types'
import type { Category, CityData, Entry } from './types'

export const demoStorageKey = 'fenix-demo-v1'
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const validDate = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
const positiveId = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0

function validEntries(value: unknown, category: Category): value is Entry[] {
  if (!Array.isArray(value)) return false
  const ids = new Set<number>()
  return value.every((entry) => {
    if (!object(entry) || !positiveId(entry.id) || ids.has(Number(entry.id))) return false
    ids.add(Number(entry.id))
    if (
      !Object.entries(emptyEntry).every(([key, sample]) => {
        if (['last_seen', 'next_maintenance', 'characteristics'].includes(key)) return true
        return typeof entry[key] === typeof sample
      })
    )
      return false
    if (entry.last_seen !== null && !validDate(entry.last_seen)) return false
    if (entry.next_maintenance !== null && !validDate(entry.next_maintenance)) return false
    return Object.keys(validateEntry(entry, category, [])).length === 0
  })
}
export function validDemo(value: unknown): value is CityData {
  if (
    !object(value) ||
    !validEntries(value.equipment, 'equipment') ||
    !validEntries(value.agents, 'agent') ||
    !Array.isArray(value.events)
  )
    return false
  const ids = new Set<number>()
  return value.events.every((event) => {
    if (!object(event) || !positiveId(event.id) || ids.has(Number(event.id))) return false
    ids.add(Number(event.id))
    if (!(
      (positiveId(event.equipment) && event.agent === null) ||
      (positiveId(event.agent) && event.equipment === null)
    ))
      return false
    if (
      !['heartbeat', 'failure', 'recovery', 'maintenance_done', 'position'].includes(
        String(event.kind),
      ) ||
      !validDate(event.timestamp)
    )
      return false
    if (!['external_id', 'origin', 'description'].every((key) => typeof event[key] === 'string'))
      return false
    if (event.resource_name !== undefined && typeof event.resource_name !== 'string') return false
    if (event.status !== undefined && typeof event.status !== 'string') return false
    for (const [key, max] of [
      ['latitude', 90],
      ['longitude', 180],
    ] as const) {
      if (
        event[key] != null &&
        (typeof event[key] !== 'number' ||
          !Number.isFinite(event[key]) ||
          Math.abs(event[key]) > max)
      )
        return false
    }
    return (event.latitude == null) === (event.longitude == null)
  })
}
function upgradeExamples(data: CityData): CityData {
  const names = new Map<number, string>()
  const equipment = data.equipment.map((entry) => {
    const index = Number(/^DEMO-(\d{3})$/.exec(entry.serial)?.[1]) - 1
    const example = catalog.equipment[index]
    if (!example || entry.brand !== 'Demonstração' || entry.model !== `Modelo ${index + 1}`)
      return entry
    names.set(entry.id, example.serial)
    return {
      ...entry,
      serial: example.serial,
      brand: example.brand,
      model: example.model,
      street: entry.street === 'Via demonstrativa' ? example.street : entry.street,
      reference: entry.reference === 'Local fictício' ? example.reference : entry.reference,
    }
  })
  const agents = data.agents.map((entry) => {
    const index = Number(/^DEMO-A(\d+)$/.exec(entry.registration)?.[1]) - 1
    const example = catalog.agents[index]
    return example && entry.name === `Agente demonstrativo ${index + 1}`
      ? { ...entry, name: example.name, registration: example.registration }
      : entry
  })
  const events = data.events.map((event) =>
    event.equipment && names.has(event.equipment) && /^DEMO-\d{3}$/.test(event.resource_name || '')
      ? { ...event, resource_name: names.get(event.equipment) }
      : event,
  )
  return { equipment, agents, events }
}
export function readDemo(): { data: CityData; warning: string } {
  try {
    const raw = localStorage.getItem(demoStorageKey)
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw)
      if (validDemo(parsed)) return { data: upgradeExamples(parsed), warning: '' }
      return {
        data: seed(),
        warning:
          'Os dados locais estão inválidos. Novos exemplos foram carregados; os dados anteriores só serão substituídos ao salvar uma alteração.',
      }
    }
  } catch {
    return {
      data: seed(),
      warning: 'Não foi possível ler os dados locais. A demonstração foi reiniciada nesta sessão.',
    }
  }
  return { data: seed(), warning: '' }
}
