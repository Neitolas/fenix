import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Entry, Category } from '../types'
import { statuses, agentStatuses, kinds } from '../types'

export default function CityMap({
  equipment,
  agents,
  onSelect,
}: {
  equipment: Entry[]
  agents: Entry[]
  onSelect: (e: Entry, c: Category) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<L.LayerGroup | null>(null)
  const callback = useRef(onSelect)
  useEffect(() => {
    callback.current = onSelect
  }, [onSelect])
  useEffect(() => {
    if (!container.current) return
    const instance = L.map(container.current).setView([-22.21, -49.94], 13)
    map.current = instance
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(instance)
    layers.current = L.layerGroup().addTo(instance)
    tiles.on('tileerror', () =>
      container.current?.setAttribute(
        'data-map-warning',
        'Sem acesso aos mapas externos. Use a lista de recursos.',
      ),
    )
    return () => {
      instance.remove()
      map.current = null
      layers.current = null
    }
  }, [])
  useEffect(() => {
    if (!layers.current) return
    layers.current.clearLayers()
    const points: L.LatLngExpression[] = []
    for (const [list, category] of [
      [equipment, 'equipment'],
      [agents, 'agent'],
    ] as const) {
      for (const e of list) {
        if (!Number.isFinite(Number(e.latitude)) || !Number.isFinite(Number(e.longitude))) continue
        const p: L.LatLngExpression = [Number(e.latitude), Number(e.longitude)]
        points.push(p)
        const color =
          category === 'agent'
            ? '#79b7ef'
            : e.status === 'operational'
              ? '#8cd2a5'
              : ['fault', 'stolen'].includes(e.status)
                ? '#f58d7d'
                : '#e7ae53'
        const tooltip = document.createElement('span')
        tooltip.textContent = `${e.serial || e.name} · ${category === 'agent' ? agentStatuses[e.status] : kinds[e.kind] + ' · ' + statuses[e.status]}`
        L.circleMarker(p, {
          radius: category === 'agent' ? 5 : 9,
          color,
          fillColor: color,
          fillOpacity: 0.85,
          weight: 2,
        })
          .bindTooltip(tooltip)
          .on('click', () => callback.current(e, category))
          .addTo(layers.current)
      }
    }
    if (points.length && map.current)
      map.current.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 14 })
  }, [equipment, agents])
  return (
    <>
      <div
        className="city-map"
        ref={container}
        role="region"
        aria-label="Mapa dos equipamentos e agentes"
      />
      <p className="map-help">
        Círculos maiores: equipamentos. Menores em azul: agentes. Clique para consultar. A lista
        continua disponível sem o mapa.
      </p>
    </>
  )
}
