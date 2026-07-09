import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type Tournament = {
  id: string
  name: string
  competition_code: string | null
  season_year: number | null
  status: 'draft' | 'open' | 'locked' | 'live' | 'finished'
  created_at: string
}

type RealtimeState = 'connecting' | 'connected' | 'reconnecting' | 'error' | 'offline'

const statusLabel: Record<Tournament['status'], string> = {
  draft: 'Borrador',
  open: 'Abierto',
  locked: 'Bloqueado',
  live: 'En juego',
  finished: 'Finalizado',
}

const statusClass: Record<Tournament['status'], string> = {
  draft: 'status-pill status-pill--draft',
  open: 'status-pill status-pill--open',
  locked: 'status-pill status-pill--locked',
  live: 'status-pill status-pill--live',
  finished: 'status-pill status-pill--finished',
}

const realtimeLabel: Record<RealtimeState, string> = {
  connecting: 'Conectando en directo…',
  connected: 'Lista sincronizada en directo',
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

export function CompetitionsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('connecting')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const loadTournaments = async () => {
    try {
      setError(null)

      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, competition_code, season_year, status, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      setTournaments((data ?? []) as Tournament[])
      setLastUpdatedAt(new Date())
    } catch (err: any) {
      setError(err.message ?? 'No se pudieron cargar las competiciones.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    setRealtimeState('connecting')
    loadTournaments()

    const channel = supabase
      .channel('competitions-page-tournaments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments',
        },
        () => {
          loadTournaments()
        }
      )
      .subscribe((status, err) => {
        setRealtimeState(mapRealtimeStatus(status))

        if (status === 'SUBSCRIBED') {
          loadTournaments()
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime competitions error:', status, err)
        }
      })

    return () => {
      supabase.removeChannel(channel)
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

  const stats = useMemo(() => {
    return {
      total: tournaments.length,
      open: tournaments.filter((t) => t.status === 'open' || t.status === 'draft').length,
      live: tournaments.filter((t) => t.status === 'live').length,
    }
  }, [tournaments])

  const hasLiveTournament = tournaments.some((t) => t.status === 'live')

  return (
    <div className="page page-competitions">
      <div className="page-header">
        <p className="eyebrow">Competiciones</p>
        <h1>Elige una edición</h1>
        <p className="page-header-subtitle">
          Explora los torneos disponibles, revisa su estado y entra al detalle de cada edición.
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

          {hasLiveTournament && (
            <span className="status-pill status-pill--live">
              Hay torneos en directo
            </span>
          )}
        </div>
      </section>

      {!loading && !error && (
        <section className="card competitions-summary-card">
          <div className="section-header">
            <span className="section-title">Resumen</span>
          </div>

          <div className="info-grid competitions-summary-grid">
            <div className="info-item">
              <span className="info-label">Total</span>
              <span className="info-value">{stats.total}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Abiertas</span>
              <span className="info-value">{stats.open}</span>
            </div>

            <div className="info-item">
              <span className="info-label">En juego</span>
              <span className="info-value">{stats.live}</span>
            </div>
          </div>
        </section>
      )}

      {loading && (
        <section className="card">
          <p className="muted">Cargando competiciones...</p>
        </section>
      )}

      {error && (
        <section className="card">
          <p className="error-text">{error}</p>
        </section>
      )}

      {!loading && tournaments.length === 0 && !error && (
        <section className="card">
          <p className="muted">No hay competiciones disponibles todavía.</p>
        </section>
      )}

      {!loading && tournaments.length > 0 && (
        <div className="competitions-list">
          {tournaments.map((t) => (
            <article key={t.id} className="competition-card competition-card--app">
              <div className="competition-card-top">
                <div className="competition-card-top-left">
                  <span className="competition-badge">
                    {t.competition_code ?? 'Torneo'}
                  </span>

                  {t.season_year && (
                    <span className="meta-chip">
                      {t.season_year}
                    </span>
                  )}
                </div>

                <span className={statusClass[t.status]}>
                  {statusLabel[t.status]}
                </span>
              </div>

              <div className="competition-card-main">
                <h2 className="competition-title">{t.name}</h2>

                <p className="competition-description">
                  Consulta el detalle del torneo, su seguimiento y la información general de esta edición.
                </p>
              </div>

              <div className="competition-card-footer competition-card-footer--app">
                <div className="competition-card-footer-copy">
                  <span className="info-label">Acción</span>
                  <span className="muted">Entrar al torneo</span>
                </div>

                <Link to={`/competition/${t.id}`} className="competition-link">
                  Abrir <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}