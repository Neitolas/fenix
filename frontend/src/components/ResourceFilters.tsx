import type { Category, Filters } from '../types'
import { kinds, statuses, agentStatuses } from '../types'
type Props = {
  filters: Filters
  onChange: (filters: Filters) => void
  category: Category
  page: string
  regions: string[]
  agencies: string[]
  onClear: () => void
}
export default function ResourceFilters({
  filters,
  onChange,
  category,
  page,
  regions,
  agencies,
  onClear,
}: Props) {
  return (
    <div className="filters">
      <label className="search-label">
        Buscar
        <input
          placeholder="Identificação, bairro ou órgão"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </label>
      {(page !== 'inventory' || category === 'equipment') && (
        <label>
          Tipo
          <select
            value={filters.kind}
            onChange={(e) => onChange({ ...filters, kind: e.target.value })}
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
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
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
          onChange={(e) => onChange({ ...filters, region: e.target.value })}
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
          onChange={(e) => onChange({ ...filters, agency: e.target.value })}
        >
          <option value="">Todos</option>
          {agencies.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <button className="ghost" onClick={() => onClear()}>
        Limpar
      </button>
    </div>
  )
}
