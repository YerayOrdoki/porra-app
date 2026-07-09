import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

export function RecentMatchesList({ tournamentId }: { tournamentId: string }) {
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('matches')
        .select('id, stage, status, home_score, away_score, utc_date, home_team:home_team_id ( name ), away_team:away_team_id ( name )')
        .eq('tournament_id', tournamentId)
        .order('utc_date', { ascending: false })
        .limit(6)
      setRows(data ?? [])
    }
    load()
  }, [tournamentId])

  return (
    <section className="card">
      <p className="eyebrow">Últimos partidos</p>
      <div className="list-stack">
        {rows.length === 0 && <p className="muted">Todavía no hay partidos cargados.</p>}
        {rows.map((row) => (
          <div key={row.id} className="match-row">
            <div>
              <strong>{row.home_team?.name}</strong> vs <strong>{row.away_team?.name}</strong>
            </div>
            <div className="muted">{row.home_score} - {row.away_score} · {row.status}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
