//HomePage.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { TournamentStatusCard } from '../components/home/TournamentStatusCard'
import { MyRankCard } from '../components/home/MyRankCard'
import { RecentMatchesList } from '../components/home/RecentMatchesList'

export function HomePage() {
  const { user } = useAuth()
  const [tournament, setTournament] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setError(null)
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .in('status', ['open', 'locked', 'live'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error) throw error
        setTournament(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="page page-home">
      <h1>Inicio</h1>
      {loading && <p>Cargando torneo...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !tournament && <p className="muted">No hay torneo activo todavía.</p>}
      {tournament && (
        <>
          <TournamentStatusCard tournament={tournament} />
          <MyRankCard tournamentId={tournament.id} playerId={user?.id} />
          <RecentMatchesList tournamentId={tournament.id} />
        </>
      )}
    </div>
  )
}
