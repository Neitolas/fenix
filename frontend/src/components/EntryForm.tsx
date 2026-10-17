import { useState } from 'react'
import Modal from './Modal'
import type { Category, Entry } from '../types'
import { emptyEntry, kinds, statuses, agentStatuses, maintenanceLabels } from '../types'

const labels: Record<string, string> = {
  serial: 'Número de série',
  brand: 'Marca',
  model: 'Modelo',
  postal_code: 'CEP',
  city: 'Cidade',
  state: 'UF',
  street: 'Rua',
  reference: 'Referência',
  agency: 'Órgão responsável',
  neighborhood: 'Bairro',
  region: 'Região',
  latitude: 'Latitude',
  longitude: 'Longitude',
  name: 'Nome',
  registration: 'Matrícula',
  role: 'Função',
}
export default function EntryForm({
  entry,
  category,
  onSave,
  onClose,
  onDelete,
  onEvent,
}: {
  entry: Entry | null
  category: Category
  onSave: (draft: Entry) => Promise<void>
  onClose: () => void
  onDelete: () => Promise<void>
  onEvent: (kind: string) => Promise<void>
}) {
  const initial = entry || {
    ...emptyEntry,
    ...(category === 'agent' ? { kind: 'agent', status: 'available' } : {}),
  }
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...initial })
  const [characteristics, setCharacteristics] = useState(
    JSON.stringify(initial.characteristics, null, 2),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (key: string, value: string) => setDraft((d) => ({ ...d, [key]: value }))
  async function action(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      const error = e as Error & { errors?: Record<string, string> }
      setError(error.message)
      setErrors(error.errors || {})
    } finally {
      setBusy(false)
    }
  }
  const fields =
    category === 'equipment'
      ? [
          'serial',
          'brand',
          'model',
          'agency',
          'postal_code',
          'city',
          'state',
          'street',
          'reference',
          'neighborhood',
          'region',
          'latitude',
          'longitude',
        ]
      : [
          'name',
          'registration',
          'role',
          'agency',
          'neighborhood',
          'region',
          'latitude',
          'longitude',
        ]
  return (
    <Modal
      labelledBy="editor-title"
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <header className="dialog-head">
        <div>
          <p className="eyebrow">{category === 'equipment' ? 'Equipamento' : 'Agente'}</p>
          <h2 id="editor-title">{entry ? 'Detalhes e edição' : 'Novo cadastro'}</h2>
        </div>
        <button className="ghost" onClick={onClose} disabled={busy} aria-label="Fechar edição">
          Fechar ×
        </button>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setErrors({})
          void action(async () => {
            let attrs: Record<string, unknown> = {}
            try {
              attrs = JSON.parse(characteristics)
              if (!attrs || Array.isArray(attrs) || typeof attrs !== 'object') throw Error()
            } catch {
              throw new Error('Características devem ser um objeto JSON válido.')
            }
            await onSave({
              ...draft,
              latitude: Number(draft.latitude),
              longitude: Number(draft.longitude),
              next_maintenance: draft.next_maintenance || null,
              characteristics: attrs,
            } as Entry)
          })
        }}
      >
        <div className="form-grid">
          {category === 'equipment' && (
            <label>
              Tipo
              <select value={String(draft.kind)} onChange={(e) => set('kind', e.target.value)}>
                {Object.entries(kinds).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          {fields.map((key) => (
            <label key={key}>
              {labels[key]}
              <input
                required
                value={String(draft[key] ?? '')}
                maxLength={key === 'state' ? 2 : 150}
                type={['latitude', 'longitude'].includes(key) ? 'number' : 'text'}
                step={['latitude', 'longitude'].includes(key) ? 'any' : undefined}
                min={key === 'latitude' ? -90 : key === 'longitude' ? -180 : undefined}
                max={key === 'latitude' ? 90 : key === 'longitude' ? 180 : undefined}
                onChange={(e) => set(key, e.target.value)}
                aria-invalid={!!errors[key]}
              />
              {errors[key] && <small className="field-error">{errors[key]}</small>}
            </label>
          ))}
          <label>
            Situação
            <select value={String(draft.status)} onChange={(e) => set('status', e.target.value)}>
              {Object.entries(category === 'equipment' ? statuses : agentStatuses).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {category === 'equipment' && (
            <>
              <label>
                Manutenção
                <select
                  value={String(draft.maintenance)}
                  onChange={(e) => set('maintenance', e.target.value)}
                >
                  {Object.entries(maintenanceLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Próxima manutenção
                <input
                  type="date"
                  required={draft.maintenance === 'scheduled'}
                  value={String(draft.next_maintenance || '')}
                  onChange={(e) => set('next_maintenance', e.target.value)}
                />
                {errors.next_maintenance && (
                  <small className="field-error">{errors.next_maintenance}</small>
                )}
              </label>
              <label className="wide">
                Características específicas (JSON)
                <textarea
                  rows={3}
                  value={characteristics}
                  onChange={(e) => setCharacteristics(e.target.value)}
                />
                <small>
                  Ex.: {`{"night_vision": true}`} ou {`{"speed_limit": 60}`}
                </small>
                {errors.characteristics && (
                  <small className="field-error">{errors.characteristics}</small>
                )}
              </label>
            </>
          )}
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="primary" disabled={busy}>
            {busy ? 'Aguarde…' : 'Salvar cadastro'}
          </button>
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
        </div>
      </form>
      {entry && (
        <div className="detail-actions">
          <p className="muted">
            Último sinal:{' '}
            {entry.last_seen
              ? new Date(entry.last_seen).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
              : 'Sem histórico'}
          </p>
          <h3>Registrar evento simulado</h3>
          <p className="muted">
            Ação manual para demonstrar a central. Não representa um sensor real.
          </p>
          <div className="button-row">
            <button disabled={busy} onClick={() => void action(() => onEvent('heartbeat'))}>
              Sinal de atividade
            </button>
            {category === 'equipment' && (
              <>
                <button disabled={busy} onClick={() => void action(() => onEvent('failure'))}>
                  Simular falha
                </button>
                <button
                  disabled={busy}
                  onClick={() => void action(() => onEvent('maintenance_done'))}
                >
                  Concluir manutenção
                </button>
              </>
            )}
          </div>
          <div className="danger-zone">
            {confirmDelete ? (
              <>
                <span>Excluir este registro do inventário?</span>
                <button className="danger" disabled={busy} onClick={() => void action(onDelete)}>
                  Confirmar exclusão
                </button>
                <button className="ghost" onClick={() => setConfirmDelete(false)}>
                  Manter registro
                </button>
              </>
            ) : (
              <button className="ghost danger-text" onClick={() => setConfirmDelete(true)}>
                Excluir do inventário
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
