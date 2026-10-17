import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category, CityData, Entry, Filters, Risk } from './types'
import { kinds, statuses, agentStatuses, riskLabels } from './types'
import {
  seed,
  attention,
  filterEntries,
  indicators,
  applyEvent,
  validateEntry,
  localDay,
  nextResourceId,
} from './domain'
import * as api from './api'
import EntryForm from './components/EntryForm'
import CityMap from './components/CityMap'
import Modal from './components/Modal'

const emptyFilters: Filters = { search: '', kind: '', status: '', region: '', agency: '' }
const initialData: CityData = { equipment: [], agents: [], events: [] }
const storageKey = 'fenix-demo-v1'
const eventLabels: Record<string, string> = {
  failure: 'Falha',
  recovery: 'Recuperação',
  heartbeat: 'Sinal de atividade',
  maintenance_done: 'Manutenção concluída',
  position: 'Posição atualizada',
}
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
function dateLabel(value: string | null) {
  return value
    ? new Date(value.includes('T') ? value : value + 'T12:00:00-03:00').toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        ...(value.includes('T') ? {} : { dateStyle: 'short' }),
      })
    : 'Não programada'
}

export default function App() {
  const [page, setPage] = useState('home')
  const [mode, setMode] = useState<'demo' | 'server'>('demo')
  const [demo, setDemo] = useState<CityData>(readDemo)
  const [server, setServer] = useState<CityData>(initialData)
  const [serverRisks, setServerRisks] = useState<Risk[]>([])
  const [serverTrend, setServerTrend] = useState({ recent: 0, previous: 0 })
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [category, setCategory] = useState<Category>('equipment')
  const [editor, setEditor] = useState<{ entry: Entry | null; category: Category } | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState(false)
  const [now, setNow] = useState(() => Date.now())
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
  const refresh = useCallback(async () => {
    if (mode !== 'server') return
    setLoading(true)
    try {
      const session = await api.session()
      if (!session.authenticated) {
        setConnected(false)
        throw new Error('Entre na central para carregar o inventário do servidor.')
      }
      const next = await api.loadCity()
      setNow(Date.now())
      setServer(next.data)
      setServerRisks(next.risks)
      setServerTrend(next.trend)
      setConnected(true)
      setUpdated(new Date().toISOString())
      setError('')
    } catch (e) {
      setConnected(false)
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [mode])
  useEffect(() => {
    if (mode === 'demo') {
      const timer = setInterval(() => setNow(Date.now()), 5000)
      return () => clearInterval(timer)
    }
    const startup = setTimeout(() => void refresh(), 0)
    const timer = setInterval(() => void refresh(), 5000)
    return () => {
      clearTimeout(startup)
      clearInterval(timer)
    }
  }, [mode, refresh])
  const equipment = useMemo(() => filterEntries(data.equipment, filters), [data.equipment, filters])
  const agents = useMemo(
    () =>
      filterEntries(data.agents, {
        ...filters,
        kind: '',
        status: page === 'inventory' && category === 'agent' ? filters.status : '',
      }),
    [data.agents, filters, category, page],
  )
  const metric = indicators(equipment)
  const risks = useMemo(
    () =>
      mode === 'demo'
        ? equipment.map((e) => attention(e, data.events, now)).sort((a, b) => b.score - a.score)
        : serverRisks.filter((r) => equipment.some((e) => e.id === r.id)),
    [mode, equipment, data.events, serverRisks, now],
  )
  const regions = [...new Set(data.equipment.concat(data.agents).map((e) => e.region))].sort()
  const agencies = [...new Set(data.equipment.concat(data.agents).map((e) => e.agency))].sort()
  const openPage = (next: string) => {
    setPage(next)
    setFilters(emptyFilters)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openEntry = (entry: Entry, c: Category) => setEditor({ entry, category: c })
  async function save(draft: Entry) {
    if (!editor) return
    if (mode === 'demo') {
      const key = editor.category === 'equipment' ? 'equipment' : 'agents'
      const errors = validateEntry(draft, editor.category, demo[key])
      if (Object.keys(errors).length) throw new api.ApiError('Confira os campos indicados.', errors)
      const next = { ...draft, id: draft.id || nextResourceId(demo, editor.category) }
      persist({
        ...demo,
        [key]: draft.id
          ? demo[key].map((e) => (e.id === draft.id ? next : e))
          : [...demo[key], next],
      })
    } else {
      await api.save(editor.category, draft)
      await refresh()
    }
    setEditor(null)
  }
  async function remove() {
    if (!editor?.entry) return
    if (mode === 'demo') {
      const key = editor.category === 'equipment' ? 'equipment' : 'agents'
      persist({ ...demo, [key]: demo[key].filter((e) => e.id !== editor.entry?.id) })
    } else {
      await api.remove(editor.category, editor.entry.id)
      await refresh()
    }
    setEditor(null)
  }
  async function event(kind: string) {
    if (!editor?.entry) return
    if (mode === 'demo') persist(applyEvent(demo, editor.category, editor.entry.id, kind))
    else {
      await api.request('events/', 'POST', {
        resource: editor.category,
        resource_id: editor.entry.id,
        kind,
        external_id: crypto.randomUUID(),
        origin: 'simulação manual',
        description: 'Evento simulado pelo operador.',
      })
      await refresh()
    }
    setEditor(null)
  }
  const maintenanceAlerts = equipment.filter(
    (e) =>
      e.maintenance === 'immediate' ||
      ['fault', 'stolen'].includes(e.status) ||
      (e.maintenance === 'scheduled' &&
        e.next_maintenance &&
        e.next_maintenance <= localDay(new Date(now + 7 * 86400000))),
  )
  const recent =
    mode === 'server'
      ? serverTrend.recent
      : data.events.filter(
          (e) =>
            e.kind === 'failure' &&
            now - Date.parse(e.timestamp) <= 7 * 86400000 &&
            now >= Date.parse(e.timestamp),
        ).length
  const previous =
    mode === 'server'
      ? serverTrend.previous
      : data.events.filter(
          (e) =>
            e.kind === 'failure' &&
            now - Date.parse(e.timestamp) > 7 * 86400000 &&
            now - Date.parse(e.timestamp) <= 14 * 86400000,
        ).length
  const disabled = mode === 'server' && !connected
  const filterBar = (
    <div className="filters">
      <label className="search-label">
        Buscar
        <input
          placeholder="Identificação, bairro ou órgão"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
      </label>
      {(page !== 'inventory' || category === 'equipment') && (
        <label>
          Tipo
          <select
            value={filters.kind}
            onChange={(e) => setFilters({ ...filters, kind: e.target.value })}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(kinds).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Situação
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Todas</option>
          {Object.entries(
            page === 'inventory' && category === 'agent' ? agentStatuses : statuses,
          ).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Região
        <select
          value={filters.region}
          onChange={(e) => setFilters({ ...filters, region: e.target.value })}
        >
          <option value="">Todas</option>
          {regions.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label>
        Órgão
        <select
          value={filters.agency}
          onChange={(e) => setFilters({ ...filters, agency: e.target.value })}
        >
          <option value="">Todos</option>
          {agencies.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <button className="ghost" onClick={() => setFilters(emptyFilters)}>
        Limpar
      </button>
    </div>
  )
  function resourceTable(rows: Entry[], c: Category) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{c === 'equipment' ? 'Equipamento' : 'Agente'}</th>
              <th>Situação</th>
              <th>Localização</th>
              <th>Órgão</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{c === 'equipment' ? e.serial : e.name}</strong>
                  <small>
                    {c === 'equipment' ? kinds[e.kind] : e.role + ' · ' + e.registration}
                  </small>
                </td>
                <td>
                  <span className={`badge ${e.status}`}>
                    {(c === 'equipment' ? statuses : agentStatuses)[e.status]}
                  </span>
                </td>
                <td>
                  {e.neighborhood}
                  <small>{e.region}</small>
                </td>
                <td>{e.agency}</td>
                <td>
                  <button className="ghost small" onClick={() => openEntry(e, c)}>
                    Ver detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="empty-state">Nenhum registro encontrado com esses filtros.</div>
        )}
      </div>
    )
  }
  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => openPage('home')} aria-label="Fênix, início">
          F.E.N.I.X.<span>Mobilidade urbana</span>
        </button>
        <div className="header-actions">
          <span
            className={`connection ${mode === 'demo' ? 'demo' : connected ? 'connected' : 'unavailable'}`}
            role="status"
          >
            {mode === 'demo'
              ? 'Demonstração local'
              : connected
                ? 'Servidor conectado'
                : 'Central indisponível'}
          </span>
          <button
            className="ghost small"
            onClick={() => {
              setLoginOpen(true)
              setError('')
            }}
          >
            Conectar Django
          </button>
          {mode === 'server' && (
            <button
              className="ghost small"
              onClick={() => {
                void api.logout().catch(() => {})
                setMode('demo')
                setConnected(false)
                setPage('home')
              }}
            >
              Voltar à demonstração
            </button>
          )}
        </div>
      </header>
      <nav className="main-nav" aria-label="Navegação principal">
        {[
          ['home', 'Início'],
          ['inventory', 'Inventário'],
          ['operations', 'Operação'],
          ['prevention', 'Prevenção'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={page === key ? 'active' : ''}
            aria-current={page === key ? 'page' : undefined}
            onClick={() => openPage(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="mode-banner">
        {mode === 'demo' ? (
          <>
            <span className="demo-dot" />
            <span>
              <strong>Ambiente de demonstração.</strong> Dados fictícios salvos apenas neste
              navegador. Nenhuma conexão com equipamentos reais.
            </span>
            <button className="text-button" onClick={() => setResetConfirm(true)}>
              Restaurar exemplos
            </button>
          </>
        ) : (
          <>
            <span>
              Dados do Django · Atualização a cada 5 segundos ·{' '}
              {updated
                ? 'Última leitura: ' + new Date(updated).toLocaleTimeString('pt-BR')
                : 'Aguardando leitura'}
              {!connected && ' · Dados podem estar desatualizados'}
            </span>
            <button className="text-button" onClick={() => void refresh()} disabled={loading}>
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {page === 'home' ? (
        <>
          <section className="hero" aria-labelledby="title">
            <p className="eyebrow">INICIATIVA F.O.G.O.</p>
            <h1 id="title">
              Uma cidade capaz
              <br />
              de <em>recomeçar.</em>
            </h1>
          </section>
          <section className="modules" aria-label="Frentes do projeto">
            {[
              [
                'inventory',
                '01',
                'Inventário',
                'Equipamentos e agentes reunidos em uma visão da cidade.',
                `${data.equipment.length} equipamentos · ${data.agents.length} agentes`,
              ],
              [
                'operations',
                '02',
                'Operação',
                'Localização, disponibilidade e manutenção para apoiar decisões.',
                `${metric.operational} equipamentos operacionais`,
              ],
              [
                'prevention',
                '03',
                'Prevenção',
                'Históricos que ajudam a identificar riscos antes das falhas.',
                `${risks.filter((r) => r.score >= 25).length} equipamentos em atenção`,
              ],
            ].map(([key, num, title, text, detail]) => (
              <button className="module-card" key={key} onClick={() => openPage(key)}>
                <span className="number">
                  {num}
                  <span>↗</span>
                </span>
                <h2>{title}</h2>
                <p>{text}</p>
                <span className="stage">{detail}</span>
                <span className="module-link">Abrir {title.toLowerCase()} →</span>
              </button>
            ))}
          </section>
        </>
      ) : (
        <section className="workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">INICIATIVA F.O.G.O.</p>
              <h1>
                {page === 'inventory'
                  ? 'Inventário da cidade'
                  : page === 'operations'
                    ? 'Central de operações'
                    : 'Prevenção e atenção'}
              </h1>
              <p className="muted">
                {page === 'inventory'
                  ? 'Cadastre e acompanhe os recursos disponíveis.'
                  : page === 'operations'
                    ? 'Localização, disponibilidade e eventos em uma visão integrada.'
                    : 'Prioridades explicadas a partir de manutenção e histórico.'}
              </p>
            </div>
            {page === 'inventory' && (
              <button
                className="primary"
                disabled={disabled}
                onClick={() => setEditor({ entry: null, category })}
              >
                + {category === 'equipment' ? 'Novo equipamento' : 'Novo agente'}
              </button>
            )}
          </div>
          {page === 'inventory' && (
            <div className="tabs">
              {(['equipment', 'agent'] as const).map((c) => (
                <button
                  key={c}
                  className={category === c ? 'active' : ''}
                  onClick={() => {
                    setCategory(c)
                    setFilters(emptyFilters)
                  }}
                >
                  {c === 'equipment' ? 'Equipamentos' : 'Agentes'}{' '}
                  <span>{c === 'equipment' ? data.equipment.length : data.agents.length}</span>
                </button>
              ))}
            </div>
          )}
          {filterBar}
          {page === 'inventory' && (
            <>
              <div className="list-meta">
                <span>
                  {(category === 'equipment' ? equipment : agents).length} registros encontrados
                </span>
                {category === 'equipment' && (
                  <button
                    className="ghost small"
                    disabled={mode === 'demo' || disabled}
                    title={
                      mode === 'demo'
                        ? 'Requer Django conectado ao serviço PHP'
                        : 'Exportar com PHP'
                    }
                    onClick={() => void api.exportCsv(filters).catch((e) => setError(e.message))}
                  >
                    Exportar CSV · PHP
                  </button>
                )}
              </div>
              {mode === 'demo' && category === 'equipment' && (
                <p className="muted caption">
                  A exportação CSV usa o serviço PHP e está disponível na execução integrada com
                  Django.
                </p>
              )}
              {resourceTable(category === 'equipment' ? equipment : agents, category)}
            </>
          )}
          {page === 'operations' && (
            <>
              <div className="metrics">
                {[
                  ['Equipamentos', metric.total],
                  ['Operacionais', metric.operational],
                  ['Indisponíveis', metric.unavailable],
                  [
                    'Disponibilidade',
                    metric.availability === null ? 'Sem dados' : metric.availability + '%',
                  ],
                  [
                    'Agentes em atividade',
                    agents.filter((a) => ['active', 'incident'].includes(a.status)).length,
                  ],
                ].map(([label, value]) => (
                  <div className="metric" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <p className="caption muted">
                {metric.not_installed} não instalados, excluídos do cálculo de disponibilidade.
              </p>
              <div className="operation-grid">
                <div className="panel map-panel">
                  <div className="panel-heading">
                    <h2>Recursos no mapa</h2>
                    <span className="muted">{equipment.length + agents.length} recursos</span>
                  </div>
                  <CityMap equipment={equipment} agents={agents} onSelect={openEntry} />
                </div>
                <aside className="panel alerts">
                  <h2>Atenção operacional</h2>
                  {maintenanceAlerts.length === 0 ? (
                    <p className="muted">Nenhum alerta para estes filtros.</p>
                  ) : (
                    maintenanceAlerts.map((e) => (
                      <button
                        className="alert-item"
                        key={e.id}
                        onClick={() => openEntry(e, 'equipment')}
                      >
                        <span
                          className={`alert-dot ${e.maintenance === 'immediate' || ['fault', 'stolen'].includes(e.status) ? 'critical' : ''}`}
                        />
                        <span>
                          <strong>{e.serial}</strong>
                          <small>
                            {e.maintenance === 'immediate'
                              ? 'Manutenção imediata'
                              : e.maintenance === 'scheduled'
                                ? 'Manutenção: ' + dateLabel(e.next_maintenance)
                                : statuses[e.status]}
                          </small>
                        </span>
                        <span>→</span>
                      </button>
                    ))
                  )}
                </aside>
              </div>
              <div className="panel">
                <h2>Visão por região</h2>
                <div className="regions">
                  {[...new Set(equipment.map((e) => e.region))].map((region) => {
                    const m = indicators(equipment.filter((e) => e.region === region))
                    return (
                      <div className="region" key={region}>
                        <strong>{region}</strong>
                        <span>
                          {m.operational} de {m.total} operacionais
                        </span>
                        <span className={m.unavailable ? 'warning-text' : 'success-text'}>
                          {m.unavailable} indisponíveis
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="panel">
                <h2>Consultar recursos</h2>
                {resourceTable(equipment, 'equipment')}
                {agents.length > 0 && resourceTable(agents, 'agent')}
              </div>
              <div className="panel">
                <h2>Histórico de eventos</h2>
                <p className="muted caption">
                  Últimos {Math.min(200, data.events.length)} eventos. Ações manuais são
                  identificadas pela origem.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Momento</th>
                        <th>Recurso</th>
                        <th>Evento</th>
                        <th>Estado informado</th>
                        <th>Coordenadas informadas</th>
                        <th>Origem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.events
                        .filter(
                          (e) =>
                            !Object.values(filters).some(Boolean) ||
                            (e.equipment
                              ? equipment.some((x) => x.id === e.equipment)
                              : agents.some((x) => x.id === e.agent)),
                        )
                        .slice(0, 200)
                        .map((e) => (
                          <tr key={e.id}>
                            <td>{dateLabel(e.timestamp)}</td>
                            <td>{e.resource_name || e.equipment || e.agent}</td>
                            <td>{eventLabels[e.kind]}</td>
                            <td>{e.status ? statuses[e.status] || e.status : '—'}</td>
                            <td>
                              {e.latitude != null && e.longitude != null
                                ? `${e.latitude}, ${e.longitude}`
                                : '—'}
                            </td>
                            <td>{e.origin}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
          {page === 'prevention' && (
            <>
              <div className="notice">
                <strong>Índice heurístico de atenção.</strong> A pontuação organiza prioridades; não
                é uma probabilidade validada de falha.
              </div>
              <div className="metrics three">
                <div className="metric">
                  <span>Em atenção</span>
                  <strong>{risks.filter((r) => r.score >= 25).length}</strong>
                </div>
                <div className="metric">
                  <span>Falhas · últimos 7 dias (cidade)</span>
                  <strong>{recent}</strong>
                </div>
                <div className="metric">
                  <span>Falhas · 7 dias anteriores (cidade)</span>
                  <strong>{previous}</strong>
                </div>
              </div>
              <div className="risk-grid">
                {risks.map((r) => (
                  <article className="risk-card" key={r.id}>
                    <div className="risk-head">
                      <strong>{r.serial}</strong>
                      <span className={`badge ${r.level}`}>
                        Atenção {riskLabels[r.level].toLowerCase()}
                      </span>
                    </div>
                    <div className="risk-score">
                      {r.score}
                      <span>/100</span>
                    </div>
                    <div className="score-track">
                      <span style={{ width: r.score + '%' }} />
                    </div>
                    <p className="muted">
                      {kinds[r.kind]} · {r.region}
                    </p>
                    <ul>
                      {r.factors.length ? (
                        r.factors.map((f) => (
                          <li key={f.label}>
                            {f.label}
                            <strong>+{f.points}</strong>
                          </li>
                        ))
                      ) : (
                        <li>Sem fatores de atenção nesta janela.</li>
                      )}
                    </ul>
                    {!r.has_telemetry && (
                      <p className="caption muted">
                        Sem histórico de telemetria. Ausência de sinal não foi pontuada.
                      </p>
                    )}
                    {['stolen', 'disabled'].includes(r.status) && (
                      <p className="caption warning-text">
                        Recurso atualmente {statuses[r.status].toLowerCase()}; essa
                        indisponibilidade não é uma previsão.
                      </p>
                    )}
                    <p>{r.recommendation}</p>
                    <button
                      className="ghost"
                      onClick={() => {
                        const entry = data.equipment.find((e) => e.id === r.id)
                        if (entry) openEntry(entry, 'equipment')
                      }}
                    >
                      Consultar equipamento →
                    </button>
                  </article>
                ))}
              </div>
              {risks.length === 0 && (
                <div className="empty-state">Nenhum equipamento para analisar.</div>
              )}
            </>
          )}
        </section>
      )}
      {editor && (
        <EntryForm
          key={editor.category + '-' + (editor.entry?.id || 'new')}
          entry={editor.entry}
          category={editor.category}
          onSave={save}
          onClose={() => setEditor(null)}
          onDelete={remove}
          onEvent={event}
        />
      )}
      {loginOpen && (
        <Modal compact labelledBy="login-title" onClose={() => setLoginOpen(false)}>
          <h2 id="login-title">Conectar ao Django</h2>
          <p className="muted">
            Requer a execução integrada. A visualização estática do ChatGPT não hospeda o backend.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setLoading(true)
              setError('')
              void api
                .login(username, password)
                .then(() => {
                  setMode('server')
                  setLoginOpen(false)
                  setPassword('')
                })
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false))
            }}
          >
            <label>
              Usuário
              <input
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button className="primary" disabled={loading}>
                {loading ? 'Conectando…' : 'Entrar'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setLoginOpen(false)
                  setError('')
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
      {resetConfirm && (
        <Modal compact labelledBy="reset-title" onClose={() => setResetConfirm(false)}>
          <h2 id="reset-title">Restaurar demonstração?</h2>
          <p>
            Os cadastros e eventos locais serão substituídos pelos exemplos fictícios. O servidor
            não será alterado.
          </p>
          <div className="dialog-actions">
            <button
              className="danger"
              onClick={() => {
                persist(seed())
                setResetConfirm(false)
                setFilters(emptyFilters)
              }}
            >
              Restaurar exemplos
            </button>
            <button className="ghost" onClick={() => setResetConfirm(false)}>
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}
