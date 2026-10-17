export type Category = 'equipment' | 'agent'
export type Entry = {
  id: number
  kind: string
  serial: string
  name: string
  registration: string
  role: string
  agency: string
  neighborhood: string
  region: string
  latitude: number
  longitude: number
  status: string
  last_seen: string | null
  brand: string
  model: string
  postal_code: string
  city: string
  state: string
  street: string
  reference: string
  maintenance: string
  next_maintenance: string | null
  characteristics: Record<string, unknown>
}
export type CityEvent = {
  id: number
  equipment: number | null
  agent: number | null
  kind: string
  timestamp: string
  external_id: string
  origin: string
  description: string
  resource_name?: string
  status?: string
  latitude?: number | null
  longitude?: number | null
}
export type CityData = { equipment: Entry[]; agents: Entry[]; events: CityEvent[] }
export type Filters = {
  search: string
  kind: string
  status: string
  region: string
  agency: string
}
export type Risk = {
  id: number
  serial: string
  kind: string
  status: string
  region: string
  score: number
  level: string
  factors: { label: string; points: number }[]
  recommendation: string
  has_telemetry: boolean
  calculated_at: string
}
export const emptyEntry: Entry = {
  id: 0,
  kind: 'camera',
  serial: '',
  name: '',
  registration: '',
  role: '',
  agency: '',
  neighborhood: '',
  region: '',
  latitude: -22.21,
  longitude: -49.94,
  status: 'operational',
  last_seen: null,
  brand: '',
  model: '',
  postal_code: '',
  city: 'Marília',
  state: 'SP',
  street: '',
  reference: '',
  maintenance: 'none',
  next_maintenance: null,
  characteristics: {},
}
export const kinds: Record<string, string> = {
  camera: 'Câmera',
  radar: 'Radar',
  scale: 'Balança',
  parking_vehicle: 'Fiscalização de estacionamento',
  gate: 'Cancela',
  transport: 'Transporte',
  terminal: 'Totem',
  scooter: 'Patinete',
  motorcycle: 'Moto de agente',
  patrol: 'Viatura',
  other: 'Outro',
}
export const statuses: Record<string, string> = {
  operational: 'Operacional',
  fault: 'Mau funcionamento',
  maintenance: 'Em manutenção',
  disabled: 'Desativado',
  stolen: 'Furtado',
  not_installed: 'Não instalado',
}
export const agentStatuses: Record<string, string> = {
  active: 'Em atividade',
  available: 'Disponível',
  incident: 'Em ocorrência',
  off_duty: 'Fora de serviço',
}
export const maintenanceLabels: Record<string, string> = {
  none: 'Nenhuma',
  immediate: 'Imediata',
  scheduled: 'Programada',
}
export const riskLabels: Record<string, string> = {
  low: 'Baixa',
  moderate: 'Moderada',
  high: 'Alta',
  critical: 'Crítica',
}
