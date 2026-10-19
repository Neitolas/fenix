import { emptyEntry } from './types'
import type { Entry, CityEvent, Category, Risk, Filters } from './types'
let csrf = ''
export class ApiError extends Error {
  errors: Record<string, string>
  constructor(message: string, errors: Record<string, string> = {}) {
    super(message)
    this.errors = errors
  }
}
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch('/api/' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { 'X-CSRFToken': csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (response.status === 204) return undefined as T
  let data: Record<string, unknown>
  try {
    data = await response.json()
  } catch {
    throw new ApiError('Central indisponível. Verifique se o Django está em execução.')
  }
  if (!response.ok) {
    const errors: Record<string, string> = {}
    if (data.errors && typeof data.errors === 'object')
      Object.entries(data.errors).forEach(([k, v]) => {
        errors[k] = Array.isArray(v) ? v.join(' ') : String(v)
      })
    throw new ApiError(
      String(data.error || 'Não foi possível concluir. Confira os campos.'),
      errors,
    )
  }
  return data as T
}
export async function session() {
  const data = await request<{ authenticated: boolean; username: string; csrf: string }>('session/')
  csrf = data.csrf
  return data
}
export async function login(username: string, password: string) {
  await session()
  const data = await request<{ csrf: string }>('session/', 'POST', { username, password })
  csrf = data.csrf
}
export async function logout() {
  await request('session/', 'DELETE')
  csrf = ''
}
export const route = (category: Category) => (category === 'equipment' ? 'equipment/' : 'agents/')
export async function listAll(category: Category): Promise<Entry[]> {
  const result: Entry[] = []
  for (let page = 1; ; page++) {
    const data = await request<{ count: number; results: Partial<Entry>[] }>(
      route(category) + `?limit=200&page=${page}`,
    )
    if (!Number.isSafeInteger(data.count) || data.count < 0 || !Array.isArray(data.results))
      throw new ApiError('Resposta inválida durante a leitura do inventário.')
    if (!data.results.length && result.length < data.count)
      throw new ApiError('O inventário mudou durante a leitura. Atualize a central novamente.')
    result.push(
      ...data.results.map((e) => ({
        ...emptyEntry,
        ...e,
        kind: category === 'agent' ? 'agent' : e.kind || 'other',
      })),
    )
    if (result.length >= data.count) return result
  }
}
export async function loadCity() {
  const [equipment, agents, events, risks] = await Promise.all([
    listAll('equipment'),
    listAll('agent'),
    request<{ results: CityEvent[] }>('events/'),
    request<{ results: Risk[]; recent_failures: number; previous_failures: number }>('prevention/'),
  ])
  return {
    data: { equipment, agents, events: events.results },
    risks: risks.results,
    trend: { recent: risks.recent_failures, previous: risks.previous_failures },
  }
}
export async function save(category: Category, draft: Entry) {
  return request<Entry>(
    route(category) + (draft.id ? draft.id + '/' : ''),
    draft.id ? 'PUT' : 'POST',
    draft,
  )
}
export async function remove(category: Category, id: number) {
  return request(route(category) + id + '/', 'DELETE')
}
export async function exportCsv(filters: Filters) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => !!v))
  const response = await fetch('/api/reports/equipment.csv?' + params, {
    credentials: 'same-origin',
  })
  if (!response.ok) {
    let message = 'Serviço de relatórios indisponível.'
    try {
      message = (await response.json()).error || message
    } catch {
      /* Resposta sem JSON. */
    }
    throw new ApiError(message)
  }
  if (!response.headers.get('content-type')?.includes('text/csv'))
    throw new ApiError('O servidor não devolveu um CSV válido.')
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = 'fenix-equipamentos.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
