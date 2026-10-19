import { useEffect, useRef, useState } from 'react'
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
  const [mapWarning, setMapWarning] = useState('')
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layers = useRef<L.LayerGroup | null>(null)
  const boundsKey = useRef<string | null>(null)
  const positions = useRef<L.LatLngExpression[]>([])
  const callback = useRef(onSelect)
  useEffect(() => {
    callback.current = onSelect
  }, [onSelect])
  useEffect(() => {
    if (!container.current) return
    const instance = L.map(container.current).setView([-22.21, -49.94], 13)
    map.current = instance
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(instance)
    layers.current = L.layerGroup().addTo(instance)
    let failed = false
    tiles.on('tileerror', () => {
      if (!failed && map.current === instance) {
        failed = true
        instance.removeLayer(tiles)
        setMapWarning(
          'Mapa base indisponível. Os pontos continuam consultáveis; a lista de recursos permanece disponível abaixo.',
        )
      }
    })
    return () => {
      instance.remove()
      map.current = null
      layers.current = null
      boundsKey.current = null
    }
  }, [])
  useEffect(() => {
    if (!layers.current) return
    layers.current.clearLayers()
    const points: L.LatLngExpression[] = []
    const visibleIds: string[] = []
    for (const [list, category] of [
      [equipment, 'equipment'],
      [agents, 'agent'],
    ] as const) {
      for (const e of list) {
        if (!Number.isFinite(Number(e.latitude)) || !Number.isFinite(Number(e.longitude))) continue
        const p: L.LatLngExpression = [Number(e.latitude), Number(e.longitude)]
        points.push(p)
        visibleIds.push(`${category}:${e.id}`)
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
    positions.current = points
    const key = visibleIds.sort().join(',')
    if (points.length && map.current && key !== boundsKey.current)
      map.current.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 14 })
    boundsKey.current = key
  }, [equipment, agents])
  return (
    <>
      {mapWarning && (
        <p className="notice map-warning" role="status">
          {mapWarning}
        </p>
      )}
      <div className="map-actions">
        <button
          className="ghost small"
          disabled={equipment.length + agents.length === 0}
          onClick={() => {
            if (positions.current.length)
              map.current?.fitBounds(L.latLngBounds(positions.current), {
                padding: [35, 35],
                maxZoom: 14,
              })
          }}
        >
          Enquadrar recursos
        </button>
      </div>
      <div
        className="city-map"
        ref={container}
        role="region"
        aria-label="Mapa dos equipamentos e agentes"
      />
    </>
  )
}
