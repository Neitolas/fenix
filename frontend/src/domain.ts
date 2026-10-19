import catalog from '../../backend/operations/demo_catalog.json' with { type: 'json' }
import { emptyEntry, kinds, statuses, agentStatuses, maintenanceLabels } from './types.ts'
import type { CityData, CityEvent, Entry, Filters, Risk, Category } from './types.ts'

export function localDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
export function seed(): CityData {
  const now = Date.now()
  const days = (n: number) => localDay(new Date(now + n * 86400000))
  const equipment = Array.from({ length: 12 }, (_, i) => ({
    ...emptyEntry,
    id: i + 1,
    ...catalog.equipment[i],
    status: ['operational', 'operational', 'fault', 'maintenance', 'not_installed', 'disabled'][
      i % 6
    ],
    maintenance: i % 6 === 2 ? 'immediate' : i % 3 === 0 ? 'scheduled' : 'none',
    next_maintenance: i % 3 === 0 ? days(i - 4) : null,
    characteristics: i % 4 === 0 ? { night_vision: true } : i % 4 === 1 ? { speed_limit: 60 } : {},
  }))
  const agents = Array.from({ length: 6 }, (_, i) => ({
    ...emptyEntry,
    id: i + 1,
    kind: 'agent',
    ...catalog.agents[i],
    status: ['active', 'available', 'incident', 'off_duty'][i % 4],
  }))
  const events: CityEvent[] = []
  equipment.forEach((item, i) => {
    if (i % 3 === 0)
      [1, 4, 9].forEach((days) =>
        events.push({
          id: events.length + 1,
          equipment: item.id,
          agent: null,
          kind: 'failure',
          timestamp: new Date(now - days * 86400000).toISOString(),
          external_id: `demo-${i}-${days}`,
          origin: 'demonstração',
          description: `Inspeção demonstrativa: falha registrada em ${item.model}.`,
          resource_name: item.serial,
        }),
      )
  })
  return {
    equipment,
    agents,
    events: events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  }
}
export function filterEntries(entries: Entry[], filters: Filters): Entry[] {
  return entries.filter(
    (e) =>
      (!filters.search ||
        [e.serial, e.name, e.registration, e.neighborhood, e.brand, e.model, e.agency].some((v) =>
          v?.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()),
        )) &&
      (!filters.kind || e.kind === filters.kind) &&
      (!filters.status || e.status === filters.status) &&
      (!filters.region || e.region === filters.region) &&
      (!filters.agency || e.agency === filters.agency),
  )
}
export function indicators(entries: Entry[]) {
  const operational = entries.filter((e) => e.status === 'operational').length
  const unavailable = entries.filter((e) =>
    ['fault', 'maintenance', 'disabled', 'stolen'].includes(e.status),
  ).length
  return {
    total: entries.length,
    operational,
    unavailable,
    not_installed: entries.filter((e) => e.status === 'not_installed').length,
    availability:
      operational + unavailable
        ? Math.round((1000 * operational) / (operational + unavailable)) / 10
        : null,
  }
}
export function attention(item: Entry, events: CityEvent[], now = Date.now()): Risk {
  const factors: { label: string; points: number }[] = []
  if (item.maintenance === 'immediate') factors.push({ label: 'Manutenção imediata', points: 40 })
  const today = localDay(new Date(now))
  const next = localDay(new Date(now + 7 * 86400000))
  if (item.maintenance === 'scheduled' && item.next_maintenance) {
    if (item.next_maintenance < today) factors.push({ label: 'Manutenção vencida', points: 25 })
    else if (item.next_maintenance <= next)
      factors.push({ label: 'Manutenção nos próximos sete dias', points: 10 })
  }
  const failures = events.filter(
    (e) =>
      e.equipment === item.id &&
      e.kind === 'failure' &&
      Date.parse(e.timestamp) >= now - 7 * 86400000 &&
      Date.parse(e.timestamp) <= now,
  ).length
  if (failures)
    factors.push({
      label: `${failures} falha(s) nos últimos sete dias`,
      points: Math.min(30, failures * 10),
    })
  if (item.last_seen && now - Date.parse(item.last_seen) > 30 * 60000)
    factors.push({ label: 'Último sinal há mais de 30 minutos', points: 15 })
  const score = Math.min(
    100,
    factors.reduce((a, b) => a + b.points, 0),
  )
  return {
    id: item.id,
    serial: item.serial,
    kind: item.kind,
    status: item.status,
    region: item.region,
    score,
    level: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low',
    factors,
    has_telemetry: !!item.last_seen,
    calculated_at: new Date(now).toISOString(),
    recommendation:
      score >= 25
        ? 'Verificar o equipamento e priorizar a manutenção.'
        : 'Manter acompanhamento e rotina de manutenção.',
  }
}
export function nextResourceId(data: CityData, category: Category): number {
  const entries = category === 'equipment' ? data.equipment : data.agents
  return Math.max(0, ...entries.map((e) => e.id), ...data.events.map((e) => e[category] || 0)) + 1
}
export function applyEvent(data: CityData, category: Category, id: number, kind: string): CityData {
  const key = category === 'equipment' ? 'equipment' : 'agents'
  const resource = data[key].find((e) => e.id === id)
  if (!resource) throw new Error('Recurso não encontrado.')
  const timestamp = new Date().toISOString()
  const copy = { ...resource, last_seen: timestamp }
  if (category === 'equipment') {
    if (kind === 'failure') {
      copy.status = 'fault'
      copy.maintenance = 'immediate'
    }
    if (['recovery', 'maintenance_done'].includes(kind)) copy.status = 'operational'
    if (kind === 'maintenance_done') {
      copy.maintenance = 'none'
      copy.next_maintenance = null
    }
  }
  const event: CityEvent = {
    id: Math.max(0, ...data.events.map((e) => e.id)) + 1,
    equipment: category === 'equipment' ? id : null,
    agent: category === 'agent' ? id : null,
    kind,
    timestamp,
    external_id: crypto.randomUUID(),
    origin: 'demonstração local',
    description: 'Evento simulado pelo operador.',
    resource_name: resource.serial || resource.name,
    status: ['failure', 'recovery', 'maintenance_done'].includes(kind) ? copy.status : '',
    latitude: null,
    longitude: null,
  }
  return {
    ...data,
    [key]: data[key].map((e) => (e.id === id ? copy : e)),
    events: [event, ...data.events],
  }
}
export function validateEntry(
  draft: Record<string, unknown>,
  category: Category,
  existing: Entry[],
): Record<string, string> {
  const errors: Record<string, string> = {}
  const fields = [
    'agency',
    'neighborhood',
    'region',
    ...(category === 'equipment'
      ? ['serial', 'brand', 'model', 'postal_code', 'city', 'state', 'street', 'reference']
      : ['name', 'registration', 'role']),
  ]
  fields.forEach((key) => {
    if (typeof draft[key] !== 'string' || !String(draft[key]).trim())
      errors[key] = 'Preencha este campo.'
  })
  for (const [key, max] of [
    ['latitude', 90],
    ['longitude', 180],
  ] as const) {
    const v = draft[key]
    if (v === '' || v === null || !Number.isFinite(Number(v)) || Math.abs(Number(v)) > max)
      errors[key] = 'Informe uma coordenada válida.'
  }
  const attrs = draft.characteristics
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) {
    errors.characteristics = 'Informe um objeto de características.'
  } else {
    const values = attrs as Record<string, unknown>
    if ('night_vision' in values && typeof values.night_vision !== 'boolean')
      errors.characteristics = 'Visão noturna deve ser verdadeiro ou falso.'
    if (
      'speed_limit' in values &&
      (typeof values.speed_limit !== 'number' ||
        !Number.isFinite(values.speed_limit) ||
        values.speed_limit < 1 ||
        values.speed_limit > 200)
    )
      errors.characteristics = 'Limite de velocidade deve estar entre 1 e 200 km/h.'
  }
  if (!Object.hasOwn(category === 'equipment' ? statuses : agentStatuses, String(draft.status)))
    errors.status = 'Informe uma situação válida.'
  const lengths: Record<string, number> = {
    agency: 100,
    neighborhood: 100,
    region: 100,
    serial: 80,
    brand: 80,
    model: 80,
    city: 100,
    street: 150,
    reference: 150,
    name: 100,
    registration: 50,
    role: 80,
  }
  for (const key of fields) {
    if (lengths[key] && String(draft[key]).length > lengths[key])
      errors[key] = `Use até ${lengths[key]} caracteres.`
  }
  if (category === 'equipment') {
    if (!Object.hasOwn(kinds, String(draft.kind))) errors.kind = 'Informe um tipo válido.'
    if (!Object.hasOwn(maintenanceLabels, String(draft.maintenance)))
      errors.maintenance = 'Informe uma manutenção válida.'
    if (
      draft.next_maintenance &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(String(draft.next_maintenance)) ||
        !Number.isFinite(Date.parse(String(draft.next_maintenance))) ||
        new Date(String(draft.next_maintenance)).toISOString().slice(0, 10) !==
          draft.next_maintenance)
    )
      errors.next_maintenance = 'Informe uma data válida.'
  }
  if (category === 'equipment') {
    if (!/^\d{5}-?\d{3}$/.test(String(draft.postal_code)))
      errors.postal_code = 'Informe um CEP com oito dígitos.'
    if (
      !'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'
        .split(' ')
        .includes(String(draft.state).toUpperCase())
    )
      errors.state = 'Informe uma UF válida.'
    if (draft.maintenance === 'scheduled' && !draft.next_maintenance)
      errors.next_maintenance = 'Informe a data programada.'
    if (existing.some((e) => e.id !== draft.id && e.serial === draft.serial))
      errors.serial = 'Número de série já cadastrado.'
  } else if (
    existing.some(
      (e) =>
        e.id !== draft.id && e.registration === draft.registration && e.agency === draft.agency,
    )
  )
    errors.registration = 'Matrícula já cadastrada neste órgão.'
  return errors
}
