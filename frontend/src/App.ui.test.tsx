import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import {
  render,
  renderHook,
  waitFor,
  screen,
  fireEvent,
  cleanup,
  within,
  act,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import * as api from './api'
import { seed } from './domain'
import ResourceTable from './components/ResourceTable'
import { readDemo } from './demoStorage'
import { useCityConnection } from './hooks/useCityConnection'
vi.mock('./components/CityMap', () => ({ default: () => <div>Mapa de recursos</div> }))
beforeEach(() => {
  localStorage.clear()
  window.scrollTo = vi.fn()
  vi.spyOn(api, 'session').mockResolvedValue({ authenticated: false, username: '', csrf: '' })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
describe('Fluxos da central', () => {
  it('aguarda uma leitura lenta antes de iniciar outra atualização automática', async () => {
    vi.useFakeTimers()
    const snapshot = { data: seed(), risks: [], trend: { recent: 0, previous: 0 } }
    let resolveRead!: (value: typeof snapshot) => void
    const client = {
      session: vi
        .fn()
        .mockResolvedValue({ authenticated: true, username: 'operador', csrf: 'test' }),
      loadCity: vi.fn().mockImplementation(
        () =>
          new Promise<typeof snapshot>((resolve) => {
            resolveRead = resolve
          }),
      ),
      logout: vi.fn().mockResolvedValue(undefined),
    }
    const onServer = vi.fn()
    const { result } = renderHook(() => useCityConnection(onServer, client))
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(client.loadCity).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(client.loadCity).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveRead(snapshot)
    })
    expect(result.current.connected).toBe(true)
    expect(result.current.loading).toBe(false)
  })
  it('não substitui dados recentes por uma resposta atrasada', async () => {
    const oldSnapshot = { data: seed(), risks: [], trend: { recent: 0, previous: 0 } }
    const newSnapshot = structuredClone(oldSnapshot)
    newSnapshot.data.equipment[0].serial = 'ATUALIZADO'
    let resolveOld!: (value: typeof oldSnapshot) => void
    const pending = new Promise<typeof oldSnapshot>((resolve) => {
      resolveOld = resolve
    })
    const client = {
      session: vi
        .fn()
        .mockResolvedValue({ authenticated: true, username: 'operador', csrf: 'test' }),
      loadCity: vi.fn().mockReturnValueOnce(pending).mockResolvedValue(newSnapshot),
      logout: vi.fn().mockResolvedValue(undefined),
    }
    const onServer = vi.fn()
    const { result } = renderHook(() => useCityConnection(onServer, client))
    await waitFor(() => expect(client.loadCity).toHaveBeenCalledTimes(1))
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.data.equipment[0].serial).toBe('ATUALIZADO')
    await act(async () => {
      resolveOld(oldSnapshot)
    })
    expect(result.current.data.equipment[0].serial).toBe('ATUALIZADO')
    client.loadCity.mockRejectedValueOnce(new Error('offline'))
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.data.equipment[0].serial).toBe('ATUALIZADO')
    expect(result.current.connected).toBe(false)
    expect(result.current.error).toBe('offline')
    await act(async () => {
      result.current.returnToDemo()
    })
    expect(client.logout).toHaveBeenCalledTimes(1)
    expect(result.current.mode).toBe('demo')
    expect(result.current.connected).toBe(false)
  })
  it('fecha um cadastro demonstrativo antes de reconhecer uma sessão do servidor', async () => {
    const session = { authenticated: true, username: 'operador', csrf: 'test' }
    let resolveSession!: (value: typeof session) => void
    vi.mocked(api.session).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve
        }),
    )
    vi.mocked(api.session).mockResolvedValue(session)
    vi.spyOn(api, 'loadCity').mockResolvedValue({
      data: seed(),
      risks: [],
      trend: { recent: 0, previous: 0 },
    })
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Inventário' }))
    await user.click(
      within(screen.getByText('DEMO-001').closest('tr')!).getByRole('button', {
        name: 'Ver detalhes',
      }),
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
    await act(async () => resolveSession(session))
    expect(await screen.findByText('Servidor conectado')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('reconhece uma sessão autenticada sem exibir os controles removidos', async () => {
    vi.mocked(api.session).mockResolvedValue({
      authenticated: true,
      username: 'operador',
      csrf: 'test',
    })
    vi.spyOn(api, 'loadCity').mockResolvedValue({
      data: seed(),
      risks: [],
      trend: { recent: 0, previous: 0 },
    })
    render(<App />)
    expect(screen.queryByText('Conectar Django')).toBeNull()
    expect(screen.queryByText('Restaurar exemplos')).toBeNull()
    expect(screen.queryByText('Ambiente de demonstração.')).toBeNull()
    expect(await screen.findByText('Servidor conectado')).toBeTruthy()
  })
  it('abre os três módulos mantendo a demonstração identificada', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('status').textContent).toBe('Demonstração')
    await user.click(screen.getByRole('button', { name: 'Inventário' }))
    expect(screen.getByRole('heading', { name: 'Inventário da cidade' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Operação' }))
    expect(screen.getByText('Mapa de recursos')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Prevenção' }))
    expect(screen.getByText(/não é uma probabilidade validada/)).toBeTruthy()
  })
  it('cria equipamento e preserva o cadastro após remontar a aplicação', async () => {
    const user = userEvent.setup()
    const view = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Inventário' }))
    await user.click(screen.getByRole('button', { name: '+ Novo equipamento' }))
    for (const [label, value] of [
      ['Número de série', 'UI-TEST'],
      ['Marca', 'Teste'],
      ['Modelo', 'Teste'],
      ['Órgão responsável', 'Trânsito'],
      ['CEP', '17500000'],
      ['Rua', 'Via fictícia'],
      ['Referência', 'S/N'],
      ['Bairro', 'Centro'],
      ['Região', 'Central'],
    ])
      fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(label), {
        target: { value },
      })
    await user.click(screen.getByRole('button', { name: 'Salvar cadastro' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('UI-TEST')).toBeTruthy()
    view.unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Inventário' }))
    expect(screen.getByText('UI-TEST')).toBeTruthy()
  })
  it('registra uma falha simulada e a apresenta no histórico', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Inventário' }))
    const row = screen.getByText('DEMO-001').closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Ver detalhes' }))
    await user.click(screen.getByRole('button', { name: 'Simular falha' }))
    expect(
      within(screen.getByText('DEMO-001').closest('tr')!).getByText('Mau funcionamento'),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Operação' }))
    expect(screen.getByText('demonstração local')).toBeTruthy()
  })
  it('fecha o cadastro com Escape sem salvar', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Inventário' }))
    await user.click(screen.getByRole('button', { name: '+ Novo equipamento' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

it('recupera demonstração com registros corrompidos sem quebrar a tela', () => {
  localStorage.setItem(
    'fenix-demo-v1',
    JSON.stringify({ equipment: [null], agents: [], events: [] }),
  )
  render(<App />)
  expect(screen.getByRole('heading', { name: /Uma cidade capaz/ })).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toMatch(/inválidos/)
})
it('pagina tabelas sem perder registros e volta à primeira página após filtrar', async () => {
  const user = userEvent.setup()
  const rows = Array.from({ length: 51 }, (_, i) => ({
    ...seed().equipment[0],
    id: i + 1,
    serial: `PAG-${i + 1}`,
  }))
  const props = { rows, category: 'equipment' as const, onOpen: vi.fn() }
  const view = render(<ResourceTable {...props} />)
  expect(screen.queryByText('PAG-51')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Próxima página de equipamentos' }))
  expect(screen.getByText('PAG-51')).toBeTruthy()
  view.rerender(<ResourceTable {...props} rows={rows.slice(0, 1)} />)
  expect(screen.getByText('PAG-1')).toBeTruthy()
})

it.each([
  '{bad',
  JSON.stringify({ equipment: [null], agents: [], events: [] }),
  JSON.stringify({ ...seed(), events: [null] }),
  JSON.stringify({ ...seed(), events: [{ ...seed().events[0], timestamp: 'invalid' }] }),
  JSON.stringify({ ...seed(), equipment: [{ ...seed().equipment[0], latitude: 91 }] }),
])('recupera armazenamento inválido sem sobrescrever a cópia original: %s', (raw) => {
  localStorage.setItem('fenix-demo-v1', raw)
  const recovered = readDemo()
  expect(recovered.data.equipment).toHaveLength(12)
  expect(recovered.warning).not.toBe('')
  expect(localStorage.getItem('fenix-demo-v1')).toBe(raw)
})
it('mantém dados válidos e funciona quando o armazenamento é bloqueado', () => {
  const original = seed()
  original.equipment[0].serial = 'PRESERVADO'
  localStorage.setItem('fenix-demo-v1', JSON.stringify(original))
  expect(readDemo().data.equipment[0].serial).toBe('PRESERVADO')
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('bloqueado')
  })
  expect(readDemo().data.equipment).toHaveLength(12)
  expect(readDemo().warning).not.toBe('')
})
