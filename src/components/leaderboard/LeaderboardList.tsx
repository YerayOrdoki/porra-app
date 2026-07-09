export function LeaderboardList({ rows }: { rows: any[] }) {
  if (!rows.length) return <p className="muted">Todavía no hay clasificación disponible.</p>

  return (
    <div className="list-stack">
      {rows.map((row, index) => (
        <div key={row.player?.id ?? index} className="leaderboard-row card compact-card">
          <div>
            <p className="eyebrow">#{row.rank_position ?? index + 1}</p>
            <h2>{row.player?.display_name ?? row.player?.username ?? 'Jugador'}</h2>
          </div>
          <div className="points-pill">{row.total_points ?? 0} pts</div>
        </div>
      ))}
    </div>
  )
}
