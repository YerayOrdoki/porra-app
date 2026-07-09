import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type Tournament = {
  id: string
  name: string
  status: 'open' | 'locked' | 'live' | 'finished' | 'draft'
  created_at: string
}

type Pot = {
  id: string
  pot_number: number
  name: string
}

type TeamOption = {
  id: string
  name: string
  pot_id: string
}

type PlayerEntry = {
  id: string
  tournament_id: string
  player_id: string
  combination_key: string
  created_at: string
}

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

export function MyPorraPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()

  const [userId, setUserId] = useState<string | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [pots, setPots] = useState<Pot[]>([])
  const [teamsByPot, setTeamsByPot] = useState<Record<string, TeamOption[]>>({})
  const [selections, setSelections] = useState<Record<string, string | null>>({})
  const [existingEntry, setExistingEntry] = useState<PlayerEntry | null>(null)

  const [loading, setLoading] = useState(true)
  const [savingDraft, setSavingDraft] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError

        const currentUser = authData.user
        if (!currentUser) {
          setUserId(null)
          setTournament(null)
          setPots([])
          setTeamsByPot({})
          setSelections({})
          setExistingEntry(null)
          return
        }

        setUserId(currentUser.id)

        if (!tournamentId) {
          setTournament(null)
          setPots([])
          setTeamsByPot({})
          setSelections({})
          setExistingEntry(null)
          setError('No se ha indicado ningún torneo.')
          return
        }

        const { data: t, error: tErr } = await supabase
          .from('tournaments')
          .select('id, name, status, created_at')
          .eq('id', tournamentId)
          .maybeSingle()

        if (tErr) throw tErr

        if (!t) {
          setTournament(null)
          setPots([])
          setTeamsByPot({})
          setSelections({})
          setExistingEntry(null)
          setError('No se ha encontrado este torneo.')
          return
        }

        setTournament(t as Tournament)

        const { data: potsData, error: pErr } = await supabase
          .from('pots')
          .select('id, pot_number, name')
          .eq('tournament_id', t.id)
          .order('pot_number', { ascending: true })

        if (pErr) throw pErr

        const safePots = (potsData ?? []) as Pot[]
        setPots(safePots)

        const { data: ttData, error: ttErr } = await supabase
          .from('tournament_teams')
          .select('pot_id, team:team_id ( id, name )')
          .eq('tournament_id', t.id)

        if (ttErr) throw ttErr

        const map: Record<string, TeamOption[]> = {}

        for (const pot of safePots) {
          map[pot.id] = []
        }

        for (const row of ttData ?? []) {
          const potId = (row as any).pot_id as string | null
          const team = (row as any).team

          if (!potId) continue
          if (!map[potId]) map[potId] = []

          if (team?.id && team?.name) {
            map[potId].push({
              id: team.id,
              name: team.name,
              pot_id: potId,
            })
          }
        }

        setTeamsByPot(map)

        const { data: selData, error: sErr } = await supabase
          .from('player_selections')
          .select('pot_id, team_id')
          .eq('tournament_id', t.id)
          .eq('player_id', currentUser.id)

        if (sErr) throw sErr

        const selMap: Record<string, string | null> = {}

        for (const pot of safePots) {
          const found = (selData ?? []).find((s: any) => s.pot_id === pot.id)
          selMap[pot.id] = found?.team_id ?? null
        }

        setSelections(selMap)

        const { data: entryData, error: entryErr } = await supabase
          .from('player_entries')
          .select('*')
          .eq('tournament_id', t.id)
          .eq('player_id', currentUser.id)
          .maybeSingle()

        if (entryErr) throw entryErr

        setExistingEntry((entryData as PlayerEntry | null) ?? null)
      } catch (err: any) {
        setError(err.message ?? 'No se pudo cargar tu porra.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [tournamentId])

  const isTournamentEditable = useMemo(() => {
    return !!tournament && (tournament.status === 'draft' || tournament.status === 'open')
  }, [tournament])

  const complete = useMemo(() => {
    return pots.length > 0 && pots.every((pot) => !!selections[pot.id])
  }, [pots, selections])

  const completedCount = useMemo(() => {
    return pots.filter((pot) => !!selections[pot.id]).length
  }, [pots, selections])

  const progressPercent = useMemo(() => {
    if (!pots.length) return 0
    return Math.round((completedCount / pots.length) * 100)
  }, [completedCount, pots])

  const hasExistingConfirmedEntry = useMemo(() => {
    return !!existingEntry
  }, [existingEntry])

  const handleChange = (potId: string, teamId: string | null) => {
    setSelections((prev) => ({ ...prev, [potId]: teamId }))
    setError(null)
    setSuccessMessage(null)
  }

  const buildRows = () => {
    if (!tournament || !userId) return []

    return pots.map((pot) => ({
      tournament_id: tournament.id,
      player_id: userId,
      pot_id: pot.id,
      team_id: selections[pot.id]!,
    }))
  }

  const handleSaveDraft = async () => {
    if (!isTournamentEditable || !tournament || !userId) return

    setSavingDraft(true)
    setError(null)
    setSuccessMessage(null)

    try {
      if (!complete) {
        throw new Error('Debes elegir un equipo en cada bombo.')
      }

      const rows = buildRows()

      const { error: upsertError } = await supabase
        .from('player_selections')
        .upsert(rows, {
          onConflict: 'tournament_id,player_id,pot_id',
        })

      if (upsertError) throw upsertError

      setSuccessMessage(
        hasExistingConfirmedEntry
          ? 'Cambios guardados correctamente sobre tu porra existente.'
          : 'Selecciones guardadas correctamente.'
      )
    } catch (err: any) {
      setError(err.message ?? 'No se pudieron guardar las selecciones.')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleConfirmEntry = async () => {
    if (!isTournamentEditable || !tournament || !userId) return

    setConfirming(true)
    setError(null)
    setSuccessMessage(null)

    try {
      if (!complete) {
        throw new Error('Debes elegir un equipo en cada bombo antes de confirmar.')
      }

      const rows = buildRows()

      const { error: upsertError } = await supabase
        .from('player_selections')
        .upsert(rows, {
          onConflict: 'tournament_id,player_id,pot_id',
        })

      if (upsertError) throw upsertError

      const { data: rpcData, error: rpcError } = await supabase.rpc('upsert_player_entry', {
        tournament_uuid: tournament.id,
        player_uuid: userId,
      })

      if (rpcError) throw rpcError

      setExistingEntry((rpcData as PlayerEntry) ?? null)

      setSuccessMessage(
        hasExistingConfirmedEntry
          ? 'Porra actualizada y confirmada de nuevo correctamente.'
          : 'Porra confirmada correctamente.'
      )
    } catch (err: any) {
      setError(err.message ?? 'No se pudo confirmar la porra.')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="page page-mi-porra">
        <div className="page-header">
          <p className="eyebrow">Mi porra</p>
          <h1>Preparando tu edición</h1>
          <p className="page-header-subtitle">Cargando tus bombos y selecciones...</p>
        </div>

        <section className="card">
          <p className="muted">Cargando...</p>
        </section>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="page page-mi-porra">
        <div className="page-header">
          <p className="eyebrow">Mi porra</p>
          <h1>Acceso necesario</h1>
          <p className="page-header-subtitle">
            Necesitas iniciar sesión para acceder a esta porra.
          </p>
        </div>

        <section className="card">
          <p className="muted">No hay usuario autenticado.</p>
        </section>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="page page-mi-porra">
        <div className="page-header">
          <p className="eyebrow">Mi porra</p>
          <h1>Torneo no disponible</h1>
          <p className="page-header-subtitle">
            No se ha podido abrir la edición solicitada.
          </p>
        </div>

        <section className="card">
          <p className="muted">No hay torneo disponible.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="page page-mi-porra">
      <div className="page-header">
        <p className="eyebrow">Mi porra</p>
        <h1>{tournament.name}</h1>
        <p className="page-header-subtitle">
          Elige un equipo por bombo y deja tu combinación lista para esta edición.
        </p>
      </div>

      <section className="card my-porra-summary-card">
        <div className="competition-card-top">
          <div>
            <p className="eyebrow">Estado del torneo</p>
            <h2 className="card-title">Tu combinación</h2>
          </div>
          <span className={tournamentStatusClass[tournament.status]}>
            {tournamentStatusLabel[tournament.status]}
          </span>
        </div>

        <div className="info-grid my-porra-summary-grid">
          <div className="info-item">
            <span className="info-label">Bombos completos</span>
            <span className="info-value">
              {completedCount}/{pots.length}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Progreso</span>
            <span className="info-value">{progressPercent}%</span>
          </div>
          <div className="info-item">
            <span className="info-label">Estado de tu porra</span>
            <span className="info-value">
              {hasExistingConfirmedEntry ? 'Confirmada' : 'Pendiente'}
            </span>
          </div>
        </div>

        <div className="my-porra-progress">
          <div
            className="my-porra-progress-bar"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {!isTournamentEditable && (
          <p className="muted">La edición está cerrada para este torneo.</p>
        )}

        {tournament.status === 'draft' && (
          <p className="muted">
            El torneo está en borrador. Puedes preparar o modificar tu porra.
          </p>
        )}

        {tournament.status === 'open' && (
          <p className="muted">
            El torneo está abierto. Puedes guardar cambios y confirmar tu porra.
          </p>
        )}

        {hasExistingConfirmedEntry && isTournamentEditable && (
          <p className="muted">
            Ya habías confirmado una porra, pero todavía puedes actualizarla.
          </p>
        )}

        {hasExistingConfirmedEntry && !isTournamentEditable && (
          <p className="muted">Tu porra ya está confirmada y bloqueada.</p>
        )}

        {error && <p className="error-text">{error}</p>}
        {successMessage && <p className="success-text">{successMessage}</p>}
      </section>

      {pots.length === 0 && (
        <section className="card">
          <p className="muted">Este torneo todavía no tiene bombos configurados.</p>
        </section>
      )}

      {pots.length > 0 && (
        <div className="list-stack my-porra-pot-list">
          {pots.map((pot) => {
            const selectedTeamId = selections[pot.id]
            const selectedTeam = (teamsByPot[pot.id] ?? []).find((team) => team.id === selectedTeamId)

            return (
              <section key={pot.id} className="card compact-card my-porra-pot-card">
                <div className="my-porra-pot-top">
                  <div>
                    <p className="eyebrow">Bombo {pot.pot_number}</p>
                    <h2 className="card-title">{pot.name}</h2>
                  </div>

                  <span className={selectedTeam ? 'meta-chip my-porra-chip is-selected' : 'meta-chip'}>
                    {selectedTeam ? 'Elegido' : 'Pendiente'}
                  </span>
                </div>

                <p className="card-subtitle">
                  Selecciona un equipo para este bombo.
                </p>

                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor={`pot-${pot.id}`}>Equipo</label>
                    <select
                      id={`pot-${pot.id}`}
                      className="select-input"
                      value={selectedTeamId ?? ''}
                      disabled={!isTournamentEditable}
                      onChange={(e) => handleChange(pot.id, e.target.value || null)}
                    >
                      <option value="">Selecciona un equipo</option>
                      {(teamsByPot[pot.id] ?? []).map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedTeam && (
                  <div className="my-porra-selected-team">
                    <span className="info-label">Equipo elegido</span>
                    <strong>{selectedTeam.name}</strong>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {isTournamentEditable && pots.length > 0 && (
        <div className="my-porra-sticky-actions">
          <div className="my-porra-sticky-actions-inner">
            <div className="my-porra-sticky-copy">
              <span className="info-label">Progreso</span>
              <strong>
                {completedCount}/{pots.length} bombos
              </strong>
            </div>

            <div className="actions-row my-porra-actions">
              <button
                className="secondary-btn"
                onClick={handleSaveDraft}
                disabled={savingDraft || confirming}
              >
                {savingDraft ? 'Guardando...' : 'Guardar'}
              </button>

              <button
                className="primary-btn"
                onClick={handleConfirmEntry}
                disabled={savingDraft || confirming}
              >
                {confirming
                  ? 'Confirmando...'
                  : hasExistingConfirmedEntry
                    ? 'Actualizar'
                    : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}