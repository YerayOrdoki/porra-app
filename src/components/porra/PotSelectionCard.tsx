type Props = {
  pot: { id: string; pot_number: number; name: string }
  teams: { id: string; name: string }[]
  selectedTeamId: string | null
  onChange?: (potId: string, teamId: string | null) => void
}

export function PotSelectionCard({ pot, teams, selectedTeamId, onChange }: Props) {
  const selectedTeamName = teams.find((t) => t.id === selectedTeamId)?.name ?? 'Sin selección'

  return (
    <section className="card">
      <p className="eyebrow">Bombo {pot.pot_number}</p>
      <h2>{pot.name}</h2>

      {onChange ? (
        <select
          className="select-input"
          value={selectedTeamId ?? ''}
          onChange={(e) => onChange(pot.id, e.target.value || null)}
        >
          <option value="">Elige un equipo</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="selected-team-text">{selectedTeamName}</p>
      )}
    </section>
  )
}