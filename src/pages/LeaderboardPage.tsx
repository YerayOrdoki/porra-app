import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type LeaderboardRow = {
  tournament_id: string | null
  tournament_name: string | null
  player_id: string
  player_name: string
  total_points: number
  position: number
}

type TournamentOption = {
  tournament_id: string
  tournament_name: string
}

type RealtimeState = 'connecting' | 'connected' | 'reconnecting' | 'error' | 'offline'

const realtimeLabel: Record<RealtimeState, string> = {
  connecting: 'Conectando en directo…',
  connected: 'Clasificación sincronizada en directo',
  reconnecting: 'Reconectando…',
  error: 'Error de conexión en directo',
  offline: 'Sin conexión en directo',
}

const mapRealtimeStatus = (status: string): RealtimeState => {
  switch (status) {
    case 'SUBSCRIBED':
      return 'connected'
    case 'CHANNEL_ERROR':
      return 'error'
    case 'TIMED_OUT':
      return 'reconnecting'
    case 'CLOSED':
      return 'offline'
    default:
      return 'connecting'
  }
}

export function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('connecting')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const loadLeaderboard = async () => {
    try {
      setError(null)

      const { data, error } = await supabase
        .from('leaderboard_view')
        .select(
          'tournament_id, tournament_name, player_id, player_name, total_points, position'
        )
        .order('tournament_name', { ascending: true })
        .order('position', { ascending: true })

      if (error) throw error

      const normalized = ((data ?? []) as LeaderboardRow[]).map((row) => ({
        ...row,
        player_name: row.player_name || 'Jugador sin nombre',
        total_points: Number(row.total_points ?? 0),
        position: Number(row.position ?? 0),
      }))

      setRows(normalized)
      setLastUpdatedAt(new Date())
    } catch (err: any) {
      setError(err.message ?? 'No se pudo cargar la clasificación.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadLeaderboard()
  }, [])

  useEffect(() => {
    setRealtimeState('connecting')

    const scoresChannel = supabase
      .channel('leaderboard-selection-scores')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'selection_scores',
        },
        () => {
          loadLeaderboard()
        }
      )
      .subscribe((status, err) => {
        setRealtimeState(mapRealtimeStatus(status))

        if (status === 'SUBSCRIBED') {
          loadLeaderboard()
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime leaderboard error:', status, err)
        }
      })

    return () => {
      supabase.removeChannel(scoresChannel)
    }
  }, [])

  const formatLastUpdated = (value: Date | null) => {
    if (!value) return 'Sin actualizar todavía'

    return value.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const tournamentOptions = useMemo<TournamentOption[]>(() => {
    const map = new Map<string, TournamentOption>()

    rows.forEach((row) => {
      if (row.tournament_id && row.tournament_name) {
        map.set(row.tournament_id, {
          tournament_id: row.tournament_id,
          tournament_name: row.tournament_name,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) =>
      a.tournament_name.localeCompare(b.tournament_name, 'es')
    )
  }, [rows])

  const filteredRows = useMemo(() => {
    if (selectedTournamentId === 'all') return rows
    return rows.filter((row) => row.tournament_id === selectedTournamentId)
  }, [rows, selectedTournamentId])

  const topThree = useMemo(() => filteredRows.slice(0, 3), [filteredRows])
  const leader = filteredRows[0] ?? null

  return (
    <div className="page page-leaderboard">
      <div className="page-header">
        <h1>Clasificación por torneo</h1>
        <p className="page-header-subtitle">
          Elige el torneo que quieras y consulta el ranking en tiempo real.
        </p>
      </div>

      <section className="card realtime-status-card">
        <div className="realtime-status-row">
          <div className="realtime-status-copy">
            <span className={`live-indicator live-indicator--${realtimeState}`}>
              <span className="live-indicator-dot" aria-hidden="true" />
              {realtimeLabel[realtimeState]}
            </span>

            <span className="muted">
              Última actualización: {formatLastUpdated(lastUpdatedAt)}
            </span>
          </div>

          {leader && (
            <span className="status-pill status-pill--live">
              Líder: {leader.player_name}
            </span>
          )}
        </div>
      </section>

      <section className="card ranking-filters-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Filtro</p>
            <h2 className="card-title">Selecciona torneo</h2>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="leaderboard-tournament">Torneo</label>
            <select
              id="leaderboard-tournament"
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
            >
              <option value="all">Todos los torneos</option>
              {tournamentOptions.map((option) => (
                <option key={option.tournament_id} value={option.tournament_id}>
                  {option.tournament_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {!loading && !error && topThree.length > 0 && (
        <section className="card leaderboard-summary-card">
          <div className="section-header">
            <span className="section-title">Podio</span>
          </div>

          <div className="leaderboard-podium">
            {topThree.map((row) => (
              <article key={`${row.tournament_id}-${row.player_id}`} className="leaderboard-podium-card">
                <span className="leaderboard-podium-position">#{row.position}</span>
                <strong className="leaderboard-podium-name">{row.player_name}</strong>
                <span className="leaderboard-podium-points">
                  {row.total_points} pts
                </span>
                <span className="muted">{row.tournament_name ?? 'Sin torneo'}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {loading && (
        <section className="card">
          <p className="muted">Cargando clasificación...</p>
        </section>
      )}

      {error && (
        <section className="card">
          <p className="error-text">{error}</p>
        </section>
      )}

      {filteredRows.length > 0 ? (
        <section className="card">
          <div className="section-header">
            <span className="section-title">Clasificación</span>
            <span className="section-link">{filteredRows.length} jugadores</span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Posición</th>
                  <th>Usuario</th>
                  <th>Torneo</th>
                  <th>Puntos</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={`${row.tournament_id}-${row.player_id}`}>
                    <td>{row.position}</td>
                    <td>{row.player_name}</td>
                    <td>{row.tournament_name ?? 'Sin torneo'}</td>
                    <td>{row.total_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        !loading && (
          <section className="card">
            <p className="muted">
              No hay puntos acumulados para el torneo seleccionado.
            </p>
          </section>
        )
      )}
    </div>
  )
}
