export function TournamentStatusCard({ tournament }: { tournament: any }) {
  return (
    <section className="card">
      <p className="eyebrow">Torneo activo</p>
      <h2>{tournament.name}</h2>
      <p>Estado: <strong>{tournament.status}</strong></p>
      {tournament.selection_deadline && <p>Cierre: {new Date(tournament.selection_deadline).toLocaleString()}</p>}
    </section>
  )
}
