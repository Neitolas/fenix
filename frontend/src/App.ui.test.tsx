import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
vi.mock('./components/CityMap', () => ({ default: () => <div>Mapa de recursos</div> }))
beforeEach(() => {
  localStorage.clear()
  window.scrollTo = vi.fn()
})
afterEach(() => cleanup())
describe('Fluxos da central', () => {
  it('abre os três módulos mantendo a demonstração identificada', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('status').textContent).toBe('Demonstração local')
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
