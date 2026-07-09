import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type Tournament = {
  id: string
  name: string
  status: 'draft' | 'open' | 'locked' | 'live' | 'finished'
  selection_deadline: string | null
  competition_code: string | null
  season_year: number | null
  created_at: string
}

type PlayerEntry = {
  id: string
  tournament_id: string
  player_id: string
  created_at: string
}

type MyTournamentRow = {
  tournament: Tournament
  hasEntry: boolean
  entryId: string | null
}

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

export function MyPorrasPage() {
  const [rows, setRows] = useState<MyTournamentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError

        const user = authData.user
        if (!user) {
          setRows([])
          return
        }

        const { data: tournaments, error: tournamentsError } = await supabase
          .from('tournaments')
          .select('id, name, status, selection_deadline, competition_code, season_year, created_at')
          .order('created_at', { ascending: false })

        if (tournamentsError) throw tournamentsError

        const { data: entries, error: entriesError } = await supabase
          .from('player_entries')
          .select('id, tournament_id, player_id, created_at')
          .eq('player_id', user.id)

        if (entriesError) throw entriesError

        const entriesByTournament = new Map<string, PlayerEntry>()
        for (const entry of (entries ?? []) as PlayerEntry[]) {
          entriesByTournament.set(entry.tournament_id, entry)
        }

        const merged: MyTournamentRow[] = ((tournaments ?? []) as Tournament[]).map((tournament) => {
          const entry = entriesByTournament.get(tournament.id)

          return {
            tournament,
            hasEntry: !!entry,
            entryId: entry?.id ?? null,
          }
        })

        setRows(merged)
      } catch (err: any) {
        setError(err.message ?? 'No se pudieron cargar tus porras.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const summary = useMemo(() => {
    return {
      total: rows.length,
      confirmed: rows.filter((row) => row.hasEntry).length,
      pending: rows.filter((row) => !row.hasEntry).length,
    }
  }, [rows])

  const formatDeadline = (value: string | null) => {
    if (!value) return 'Sin cierre definido'

    const date = new Date(value)
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="page page-my-porras">
      <div className="page-header">
        <p className="eyebrow">Mis porras</p>
        <h1>Tus ediciones</h1>
        <p className="page-header-subtitle">
          Revisa el estado de tus torneos y entra a cada edición para completar o actualizar tu porra.
        </p>
      </div>

      {!loading && !error && rows.length > 0 && (
        <section className="card my-porras-summary-card">
          <div className="section-header">
            <span className="section-title">Resumen</span>
          </div>

          <div className="info-grid my-porras-summary-grid">
            <div className="info-item">
              <span className="info-label">Torneos</span>
              <span className="info-value">{summary.total}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Confirmadas</span>
              <span className="info-value">{summary.confirmed}</span>
            </div>

            <div className="info-item">
              <span className="info-label">Pendientes</span>
              <span className="info-value">{summary.pending}</span>
            </div>
          </div>
        </section>
      )}

      {loading && (
        <section className="card">
          <p className="muted">Cargando tus porras...</p>
        </section>
      )}

      {error && (
        <section className="card">
          <p className="error-text">{error}</p>
        </section>
      )}

      {!loading && !error && rows.length === 0 && (
        <section className="card">
          <p className="muted">Todavía no tienes porras disponibles.</p>
        </section>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="my-porras-list">
          {rows.map(({ tournament, hasEntry }) => (
            <article key={tournament.id} className="competition-card competition-card--app my-porra-card">
              <div className="competition-card-top">
                <div className="competition-card-top-left">
                  <span className="competition-badge">
                    {tournament.competition_code ?? 'Torneo'}
                  </span>

                  {tournament.season_year && (
                    <span className="meta-chip">
                      {tournament.season_year}
                    </span>
                  )}
                </div>

                <span className={statusClass[tournament.status]}>
                  {statusLabel[tournament.status]}
                </span>
              </div>

              <div className="competition-card-main">
                <h2 className="competition-title">{tournament.name}</h2>

                <div className="competition-meta">
                  <span className={hasEntry ? 'meta-chip my-porra-state-chip is-done' : 'meta-chip my-porra-state-chip'}>
                    {hasEntry ? 'Porra confirmada' : 'Pendiente'}
                  </span>

                  <span className="meta-chip">
                    Cierre: {formatDeadline(tournament.selection_deadline)}
                  </span>
                </div>

                <p className="competition-description">
                  {hasEntry
                    ? 'Ya tienes una porra registrada para este torneo y puedes revisar o actualizar tu edición si sigue abierta.'
                    : 'Todavía puedes preparar y guardar tu selección en esta edición.'}
                </p>
              </div>

              <div className="competition-card-footer competition-card-footer--app">
                <div className="competition-card-footer-copy">
                  <span className="info-label">Estado</span>
                  <span className="muted">
                    {hasEntry ? 'Lista para revisar' : 'Lista para completar'}
                  </span>
                </div>

                <Link to={`/me/${tournament.id}`} className="competition-link">
                  {hasEntry ? 'Ver porra' : 'Completar'} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}