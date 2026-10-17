import { useCallback, useEffect, useRef, useState } from 'react'
import type { CityData, Risk } from '../types'
import { seed } from '../domain'
import * as api from '../api'

const initialData: CityData = { equipment: [], agents: [], events: [] }
const storageKey = 'fenix-demo-v1'
const refreshIntervalMs = 5000
export type CityClient = Pick<typeof api, 'session' | 'loadCity' | 'logout'>

function readDemo(): CityData {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const d = JSON.parse(raw)
      if (Array.isArray(d.equipment) && Array.isArray(d.agents) && Array.isArray(d.events)) return d
    }
  } catch {
    /* Usa uma nova demonstração se o armazenamento não estiver disponível. */
  }
  return seed()
}
export function useCityConnection(onServerRecognized: () => void, client: CityClient = api) {
  const [mode, setMode] = useState<'demo' | 'server'>('demo')
  const [demo, setDemo] = useState<CityData>(readDemo)
  const [server, setServer] = useState<CityData>(initialData)
  const [serverRisks, setServerRisks] = useState<Risk[]>([])
  const [serverTrend, setServerTrend] = useState({ recent: 0, previous: 0 })
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const requestSequence = useRef(0)
  const inFlightRequests = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      requestSequence.current += 1
    }
  }, [])
  const data = mode === 'demo' ? demo : server
  const persist = (next: CityData) => {
    setDemo(next)
    setNow(Date.now())
    setUpdated(new Date().toISOString())
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      setError('Alterações mantidas nesta sessão, mas o navegador não permitiu salvá-las.')
    }
  }
  const refresh = useCallback(
    async (automatic = false) => {
      if (mode !== 'server') return
      if (automatic && inFlightRequests.current > 0) return
      const sequence = ++requestSequence.current
      inFlightRequests.current += 1
      const isLatest = () => mounted.current && sequence === requestSequence.current
      setLoading(true)
      try {
        const session = await client.session()
        if (!session.authenticated) {
          throw new Error('Entre na central para carregar o inventário do servidor.')
        }
        const next = await client.loadCity()
        if (!isLatest()) return
        setNow(Date.now())
        setServer(next.data)
        setServerRisks(next.risks)
        setServerTrend(next.trend)
        setConnected(true)
        setUpdated(new Date().toISOString())
        setError('')
      } catch (e) {
        if (!isLatest()) return
        setConnected(false)
        setError((e as Error).message)
      } finally {
        inFlightRequests.current -= 1
        if (isLatest()) setLoading(false)
      }
    },
    [mode, client],
  )
  useEffect(() => {
    if (mode === 'demo') {
      const timer = setInterval(() => setNow(Date.now()), refreshIntervalMs)
      return () => clearInterval(timer)
    }
    const startup = setTimeout(() => void refresh(true), 0)
    const timer = setInterval(() => void refresh(true), refreshIntervalMs)
    return () => {
      clearTimeout(startup)
      clearInterval(timer)
    }
  }, [mode, refresh])
  useEffect(() => {
    let active = true
    void client
      .session()
      .then((session) => {
        if (active && session.authenticated) {
          onServerRecognized()
          setMode('server')
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [onServerRecognized, client])
  function returnToDemo() {
    requestSequence.current += 1
    void client.logout().catch(() => {})
    setMode('demo')
    setConnected(false)
    setLoading(false)
  }
  return {
    mode,
    demo,
    data,
    serverRisks,
    serverTrend,
    connected,
    loading,
    error,
    updated,
    now,
    persist,
    refresh,
    setError,
    returnToDemo,
  }
}
