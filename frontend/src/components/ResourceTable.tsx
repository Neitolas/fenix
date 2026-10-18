import type { Category, Entry } from '../types'
import { kinds, statuses, agentStatuses } from '../types'
type Props = {
  rows: Entry[]
  category: Category
  onOpen: (entry: Entry, category: Category) => void
}
export default function ResourceTable({ rows, category, onOpen }: Props) {
  return (
    <div className="table-wrap responsive-table">
      <table role="table" aria-label={category === 'equipment' ? 'Equipamentos' : 'Agentes'}>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col">{category === 'equipment' ? 'Equipamento' : 'Agente'}</th>
            <th scope="col">Situação</th>
            <th scope="col">Localização</th>
            <th scope="col">Órgão</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((entry) => (
            <tr key={entry.id} role="row">
              <td role="cell" data-label={category === 'equipment' ? 'Equipamento' : 'Agente'}>
                <div>
                  <strong>{category === 'equipment' ? entry.serial : entry.name}</strong>
                  <small>
                    {category === 'equipment'
                      ? kinds[entry.kind]
                      : entry.role + ' · ' + entry.registration}
                  </small>
                </div>
              </td>
              <td role="cell" data-label="Situação">
                <span className={`badge ${entry.status}`}>
                  {(category === 'equipment' ? statuses : agentStatuses)[entry.status]}
                </span>
              </td>
              <td role="cell" data-label="Localização">
                <div>
                  {entry.neighborhood}
                  <small>{entry.region}</small>
                </div>
              </td>
              <td role="cell" data-label="Órgão">
                <span>{entry.agency}</span>
              </td>
              <td role="cell" data-label="Ações">
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
