import type { Category, Entry } from '../types'
import { kinds, statuses, agentStatuses } from '../types'
type Props = {
  rows: Entry[]
  category: Category
  onOpen: (entry: Entry, category: Category) => void
}
export default function ResourceTable({ rows, category, onOpen }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{category === 'equipment' ? 'Equipamento' : 'Agente'}</th>
            <th>Situação</th>
            <th>Localização</th>
            <th>Órgão</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.id}>
              <td>
                <strong>{category === 'equipment' ? entry.serial : entry.name}</strong>
                <small>
                  {category === 'equipment'
                    ? kinds[entry.kind]
                    : entry.role + ' · ' + entry.registration}
                </small>
              </td>
              <td>
                <span className={`badge ${entry.status}`}>
                  {(category === 'equipment' ? statuses : agentStatuses)[entry.status]}
                </span>
              </td>
              <td>
                {entry.neighborhood}
                <small>{entry.region}</small>
              </td>
              <td>{entry.agency}</td>
              <td>
                <button className="ghost small" onClick={() => onOpen(entry, category)}>
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
