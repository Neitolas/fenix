import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import CityMap from './CityMap'
import { seed } from '../domain'
const { fitBounds } = vi.hoisted(() => ({ fitBounds: vi.fn() }))
vi.mock('leaflet', () => {
  const chain = () => {
    const value = {
      addTo: vi.fn(() => value),
      on: vi.fn(() => value),
      bindTooltip: vi.fn(() => value),
      clearLayers: vi.fn(),
    }
    return value
  }
  return {
    default: {
      map: () => ({
        setView() {
          return this
        },
        fitBounds,
        remove: vi.fn(),
      }),
      tileLayer: chain,
      layerGroup: chain,
      circleMarker: chain,
      latLngBounds: (points: unknown) => points,
    },
  }
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('preserva o enquadramento em atualizações e permite reenquadrar manualmente', () => {
  const data = seed()
  const props = { equipment: data.equipment, agents: data.agents, onSelect: vi.fn() }
  const view = render(<CityMap {...props} />)
  expect(fitBounds).toHaveBeenCalledTimes(1)
  view.rerender(
    <CityMap
      {...props}
      equipment={data.equipment.map((e) => ({ ...e, latitude: e.latitude + 0.001 }))}
      agents={data.agents.map((e) => ({ ...e }))}
    />,
  )
  expect(fitBounds).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Enquadrar recursos' }))
  expect(fitBounds).toHaveBeenCalledTimes(2)
  view.rerender(<CityMap {...props} equipment={data.equipment.slice(0, 1)} />)
  expect(fitBounds).toHaveBeenCalledTimes(3)
})
