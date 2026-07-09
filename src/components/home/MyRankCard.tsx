import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

export function MyRankCard({ tournamentId, playerId }: { tournamentId: string; playerId?: string }) {
  const [row, setRow] = useState<any | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!playerId) return
      const { data } = await supabase
        .from('player_totals')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('player_id', playerId)
        .maybeSingle()
      setRow(data)
    }
    load()
  }, [playerId, tournamentId])

  return (
    <section className="card">
      <p className="eyebrow">Tu posición</p>
      <h2>{row?.rank_position ?? '-'}</h2>
      <p>Puntos: {row?.total_points ?? 0}</p>
    </section>
  )
}
