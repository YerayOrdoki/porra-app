import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type Tournament = {
  id: string
  name: string
  competition_code: string | null
  season_year: number | null
  status: 'draft' | 'open' | 'locked' | 'live' | 'finished'
}

type MatchRow = {
  id: string
  utc_date: string | null
  stage: string | null
  group_code: string | null
  home_team_name: string
  away_team_name: string
  status: string | null
  home_score: number | null
  away_score: number | null
  home_penalty_score: number | null
  away_penalty_score: number | null
}

type RealtimeState = 'connecting' | 'connected' | 'reconnecting' | 'error' | 'offline'

const tournamentStatusLabel: Record<Tournament['status'], string> = {
  draft: 'Borrador',
  open: 'Abierto',
  locked: 'Bloqueado',
  live: 'En juego',
  finished: 'Finalizado',
}

const tournamentStatusClass: Record<Tournament['status'], string> = {
  draft: 'status-pill status-pill--draft',
  open: 'status-pill status-pill--open',
  locked: 'status-pill status-pill--locked',
  live: 'status-pill status-pill--live',
  finished: 'status-pill status-pill--finished',
}

const statusShortLabel = (status?: string | null) => {
  if (!status) return 'Pendiente'

  switch (status.toLowerCase()) {
    case 'scheduled':
    case 'timed':
      return 'Programado'
    case 'in_play':
    case 'live':
      return 'En juego'
    case 'finished':
      return 'Finalizado'
    default:
      return status
  }
}

const realtimeLabel: Record<RealtimeState, string> = {
  connecting: 'Conectando en directo…',
  connected: 'Actualización en directo',
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

export function CompetitionPage() {
  const { id } = useParams<{ id: string }>()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('connecting')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const loadCompetition = async () => {
    if (!id) return

    try {
      setError(null)

      const { data: tData, error: tErr } = await supabase
        .from('tournaments')
        .select('id, name, competition_code, season_year, status')
        .eq('id', id)
        .maybeSingle()

      if (tErr) throw tErr

      if (!tData) {
        setTournament(null)
        setMatches([])
        setError('No se ha encontrado este torneo.')
        setLoading(false)
        return
      }

      setTournament(tData as Tournament)

      const { data: mData, error: mErr } = await supabase
        .from('matches')
        .select(`
          id,
          utc_date,
          stage,
          group_code,
          status,
          home_team:home_team_id ( name ),
          away_team:away_team_id ( name ),
          home_score,
          away_score,
          home_penalty_score,
          away_penalty_score
        `)
        .eq('tournament_id', id)
        .order('utc_date', { ascending: true })

      if (mErr) throw mErr

      const normalized: MatchRow[] = (mData ?? []).map((row: any) => ({
        id: row.id,
        utc_date: row.utc_date ?? null,
        stage: row.stage ?? null,
        group_code: row.group_code ?? null,
        status: row.status ?? null,
        home_team_name: row.home_team?.name ?? 'Equipo local',
        away_team_name: row.away_team?.name ?? 'Equipo visitante',
        home_score: row.home_score ?? null,
        away_score: row.away_score ?? null,
        home_penalty_score: row.home_penalty_score ?? null,
        away_penalty_score: row.away_penalty_score ?? null,
      }))

      setMatches(normalized)
      setLastUpdatedAt(new Date())
    } catch (err: any) {
      setError(err.message ?? 'No se pudo cargar la competición.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return

    setLoading(true)
    setRealtimeState('connecting')
    loadCompetition()

    const tournamentChannel = supabase
      .channel(`competition-tournament-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${id}`,
        },
        () => {
          loadCompetition()
        }
      )
      .subscribe((status) => {
        setRealtimeState(mapRealtimeStatus(status))
        if (status === 'SUBSCRIBED') {
          loadCompetition()
        }
      })

    const matchesChannel = supabase
      .channel(`competition-matches-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${id}`,
        },
        () => {
          loadCompetition()
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setRealtimeState('error')
        } else if (status === 'TIMED_OUT') {
          setRealtimeState('reconnecting')
        } else if (status === 'CLOSED') {
          setRealtimeState('offline')
        } else if (status === 'SUBSCRIBED') {
          setRealtimeState('connected')
        }
      })

    return () => {
      supabase.removeChannel(tournamentChannel)
      supabase.removeChannel(matchesChannel)
    }
  }, [id])

  const formatUtcDate = (value: string | null) => {
    if (!value) return 'Sin fecha'

    const date = new Date(value)
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatLastUpdated = (value: Date | null) => {
    if (!value) return 'Sin actualizar todavía'

    return value.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const renderScoreInline = (match: MatchRow) => {
    const hasRegularScore = match.home_score != null && match.away_score != null
    const hasPenalties =
      match.home_penalty_score != null && match.away_penalty_score != null

    if (!hasRegularScore && !hasPenalties) return '—'

    if (hasRegularScore && !hasPenalties) {
      return `${match.home_score} - ${match.away_score}`
    }

    return `${match.home_score ?? '—'} - ${match.away_score ?? '—'}`
  }

  const summary = useMemo(() => {
    return {
      total: matches.length,
      live: matches.filter((m) => {
        const status = m.status?.toLowerCase()
        return status === 'live' || status === 'in_play'
      }).length,
      finished: matches.filter((m) => m.status?.toLowerCase() === 'finished').length,
    }
  }, [matches])

  const isLiveNow =
    tournament?.status === 'live' ||
    matches.some((m) => {
      const status = m.status?.toLowerCase()
      return status === 'live' || status === 'in_play'
    })

  return (
    <div className="page page-competition">
      <div className="page-header">
        <p className="eyebrow">Torneo</p>
        <h1>{tournament ? tournament.name : 'Competición'}</h1>
        <p className="page-header-subtitle">
          Ve el calendario de partidos, los resultados y el estado general de esta edición.
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

          {isLiveNow && (
            <span className="status-pill status-pill--live">
              En directo
            </span>
          )}
        </div>
      </section>

      {loading && (
        <section className="card">
          <p className="muted">Cargando partidos...</p>
        </section>
      )}

      {error && (
        <section className="card">
          <p className="error-text">{error}</p>
        </section>
      )}

      {tournament && (
        <section className="card competition-summary-card">
          <div className="competition-card-top">
            <div>
              <p className="eyebrow">Resumen</p>
              <h2 className="card-title">Información del torneo</h2>
            </div>

            <span className={tournamentStatusClass[tournament.status]}>
              {tournamentStatusLabel[tournament.status]}
            </span>
          </div>

          <div className="info-grid competition-summary-grid">
            <div className="info-item">
              <span className="info-label">Código</span>
              <span className="info-value">{tournament.competition_code ?? '—'}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Temporada</span>
              <span className="info-value">{tournament.season_year ?? '—'}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Partidos</span>
              <span className="info-value">{summary.total}</span>
            </div>

            <div className="info-item">
              <span className="info-label">En juego</span>
              <span className="info-value">{summary.live}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Finalizados</span>
              <span className="info-value">{summary.finished}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Estado</span>
              <span className="info-value">{tournamentStatusLabel[tournament.status]}</span>
            </div>
          </div>
        </section>
      )}

      {!loading && matches.length === 0 && !error && (
        <section className="card">
          <p className="muted">
            No hay partidos registrados todavía para este torneo.
          </p>
        </section>
      )}

      {matches.length > 0 && (
        <section className="page-section">
          <div className="section-header">
            <span className="section-title">Partidos</span>
            <span className="section-link">{matches.length} encuentros</span>
          </div>

          <div className="match-list">
            {matches.map((m) => {
              const hasPenalties =
                m.home_penalty_score != null && m.away_penalty_score != null

              return (
                <article key={m.id} className="card compact-card match-card">
                  <div className="match-card-topline">
                    <span className="meta-chip">{m.stage ?? 'Fase sin definir'}</span>

                    {m.group_code && (
                      <span className="meta-chip">Grupo {m.group_code}</span>
                    )}

                    <span className="meta-chip match-status-chip">
                      {statusShortLabel(m.status)}
                    </span>
                  </div>

                  <div className="match-card-head">
                    <span className="match-date">{formatUtcDate(m.utc_date)}</span>
                  </div>

                  <div className="match-card-body">
                    <div className="match-team-row">
                      <span className="match-team-name">{m.home_team_name}</span>
                      <span className="match-team-score">{m.home_score ?? '—'}</span>
                    </div>

                    <div className="match-team-row">
                      <span className="match-team-name">{m.away_team_name}</span>
                      <span className="match-team-score">{m.away_score ?? '—'}</span>
                    </div>
                  </div>

                  <div className="match-card-footer">
                    <div className="score-stack">
                      <div className="score-main">{renderScoreInline(m)}</div>
                      {hasPenalties && (
                        <div className="score-penalties">
                          Penaltis: {m.home_penalty_score} - {m.away_penalty_score}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}