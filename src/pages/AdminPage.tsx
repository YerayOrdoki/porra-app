import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Tournament = {
  id: string
  name: string
  competition_code: string | null
  season_year: number | null
  status: string
}

type TournamentTeamRow = {
  id: string
  tournament_id: string
  team_name: string
  pot_id: string | null
}

type Pot = {
  id: string
  name: string
  pot_number: string
  coefficient: string
}

type CompetitionOption = { code: string; name: string }

type ScoringSettings = {
  tournament_id: string
  win_points: string
  draw_points: string
}

type StagePointRow = {
  stage_code: string
  stage_name: string
  qualification_points: string
}

const COMPETITIONS: CompetitionOption[] = [
  { code: 'CL', name: 'Champions League' },
  { code: 'WCC', name: 'Club World Cup' },
  { code: 'PD', name: 'LaLiga' },
  { code: 'PL', name: 'Premier League' },
  { code: 'SA', name: 'Serie A' },
  { code: 'BL1', name: 'Bundesliga' },
  { code: 'FL1', name: 'Ligue 1' },
  { code: 'WC', name: 'World Cup' },
]

const DEFAULT_STAGE_POINTS: StagePointRow[] = [
  { stage_code: 'GROUP_STAGE', stage_name: 'Fase de grupos', qualification_points: '0' },
  { stage_code: 'LAST_64', stage_name: 'Sesentaicuatroavos', qualification_points: '0' },
  { stage_code: 'LAST_32', stage_name: 'Treintaidosavos', qualification_points: '0' },
  { stage_code: 'LAST_16', stage_name: 'Octavos de final', qualification_points: '0' },
  { stage_code: 'QUARTER_FINALS', stage_name: 'Cuartos de final', qualification_points: '0' },
  { stage_code: 'SEMI_FINALS', stage_name: 'Semifinales', qualification_points: '0' },
  { stage_code: 'THIRD_PLACE', stage_name: 'Tercer puesto', qualification_points: '0' },
  { stage_code: 'FINAL', stage_name: 'Final', qualification_points: '0' },
]

const normalizeDecimalInput = (value: string) => value.replace(/,/g, '.')
const formatDecimalForInput = (value: string | number | null | undefined) =>
  value == null ? '1' : String(value).replace('.', ',')

const toInteger = (value: string, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toDecimal = (value: string, fallback = 1) => {
  const parsed = Number(normalizeDecimalInput(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

export function AdminPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [tournamentId, setTournamentId] = useState('')
  const [teams, setTeams] = useState<TournamentTeamRow[]>([])
  const [pots, setPots] = useState<Pot[]>([])

  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [savingPots, setSavingPots] = useState(false)
  const [savingTournamentConfig, setSavingTournamentConfig] = useState(false)
  const [importingMatches, setImportingMatches] = useState(false)
  const [loadingTeamsFromStaging, setLoadingTeamsFromStaging] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [overrideCompetition, setOverrideCompetition] = useState('')
  const [overrideSeason, setOverrideSeason] = useState('')
  const [overrideName, setOverrideName] = useState('')

  const [scoringSettings, setScoringSettings] = useState<ScoringSettings>({
    tournament_id: '',
    win_points: '3',
    draw_points: '1',
  })

  const [stagePoints, setStagePoints] = useState<StagePointRow[]>(DEFAULT_STAGE_POINTS)

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === tournamentId) ?? null,
    [tournaments, tournamentId]
  )

  const loadTournaments = async () => {
    setLoadingTournaments(true)
    setError(null)

    const { data, error } = await supabase
      .from('tournaments')
      .select('id, name, competition_code, season_year, status')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setTournaments([])
      setLoadingTournaments(false)
      return
    }

    const safe = (data ?? []) as Tournament[]
    setTournaments(safe)

    if (safe.length > 0 && !tournamentId) {
      setTournamentId(safe[0].id)
    }

    setLoadingTournaments(false)
  }

  const loadTournamentData = async (selectedId?: string) => {
    const currentTournamentId = selectedId ?? tournamentId

    if (!currentTournamentId) {
      setTeams([])
      setPots([])
      setStagePoints(DEFAULT_STAGE_POINTS)
      setScoringSettings({
        tournament_id: '',
        win_points: '3',
        draw_points: '1',
      })
      return
    }

    setLoadingData(true)
    setError(null)
    setSuccessMessage(null)

    const { data: teamsDataRaw, error: teamsError } = await supabase
      .from('tournament_teams')
      .select('id, tournament_id, pot_id, team:team_id ( name )')
      .eq('tournament_id', currentTournamentId)

    const { data: potsData, error: potsError } = await supabase
      .from('pots')
      .select('id, name, pot_number, coefficient')
      .eq('tournament_id', currentTournamentId)
      .order('pot_number', { ascending: true })

    const { data: scoringData, error: scoringError } = await supabase
      .from('tournament_scoring_settings')
      .select('tournament_id, win_points, draw_points')
      .eq('tournament_id', currentTournamentId)
      .maybeSingle()

    const { data: stagePointsData, error: stagePointsError } = await supabase
      .from('tournament_stage_points')
      .select('stage_code, stage_name, qualification_points')
      .eq('tournament_id', currentTournamentId)
      .order('stage_code', { ascending: true })

    if (teamsError || potsError || scoringError || stagePointsError) {
      setError(
        teamsError?.message ??
          potsError?.message ??
          scoringError?.message ??
          stagePointsError?.message ??
          'Error al cargar datos del torneo.'
      )
      setTeams([])
      setPots([])
      setLoadingData(false)
      return
    }

    const normalizedTeams: TournamentTeamRow[] = (teamsDataRaw ?? [])
      .map((row: any) => ({
        id: row.id,
        tournament_id: row.tournament_id,
        pot_id: row.pot_id,
        team_name: row.team?.name ?? 'Sin nombre',
      }))
      .sort((a, b) => a.team_name.localeCompare(b.team_name))

    const normalizedPots: Pot[] = ((potsData ?? []) as any[])
      .sort((a, b) => (a.pot_number ?? 0) - (b.pot_number ?? 0))
      .map((pot) => ({
        id: pot.id,
        name: pot.name ?? '',
        pot_number: pot.pot_number != null ? String(pot.pot_number) : '',
        coefficient: formatDecimalForInput(pot.coefficient),
      }))

    setTeams(normalizedTeams)
    setPots(normalizedPots)

    setScoringSettings({
      tournament_id: currentTournamentId,
      win_points: scoringData?.win_points != null ? String(scoringData.win_points) : '3',
      draw_points: scoringData?.draw_points != null ? String(scoringData.draw_points) : '1',
    })

    if (stagePointsData && stagePointsData.length > 0) {
      const normalizedStagePoints: StagePointRow[] = (stagePointsData as any[]).map((row) => ({
        stage_code: row.stage_code,
        stage_name: row.stage_name,
        qualification_points: String(row.qualification_points ?? 0),
      }))
      setStagePoints(normalizedStagePoints)
    } else {
      setStagePoints(DEFAULT_STAGE_POINTS)
    }

    setLoadingData(false)
  }

  useEffect(() => {
    loadTournaments()
  }, [])

  useEffect(() => {
    if (!tournamentId) {
      setTeams([])
      setPots([])
      setOverrideCompetition('')
      setOverrideSeason('')
      setOverrideName('')
      return
    }

    setOverrideCompetition(selectedTournament?.competition_code ?? '')
    setOverrideSeason(selectedTournament?.season_year ? String(selectedTournament.season_year) : '')
    setOverrideName(selectedTournament?.name ?? '')

    loadTournamentData(tournamentId)
  }, [tournamentId])

  const handleChangePotAssignment = (teamId: string, newPotId: string | null) => {
    setTeams((prev) =>
      prev.map((team) => (team.id === teamId ? { ...team, pot_id: newPotId } : team))
    )
  }

  const handleChangePotRow = (index: number, field: keyof Pot, value: string) => {
    setPots((prev) =>
      prev.map((pot, i) => {
        if (i !== index) return pot
        return { ...pot, [field]: value }
      })
    )
  }

  const handleAddPot = () => {
    setPots((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Bombo ${prev.length + 1}`,
        pot_number: String(prev.length + 1),
        coefficient: '1',
      },
    ])
  }

  const handleRemovePot = (potId: string) => {
    setPots((prev) => prev.filter((pot) => pot.id !== potId))
    setTeams((prev) =>
      prev.map((team) => (team.pot_id === potId ? { ...team, pot_id: null } : team))
    )
  }

  const handleChangeScoring = (field: keyof ScoringSettings, value: string) => {
    setScoringSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleChangeStagePoints = (stageCode: string, value: string) => {
    setStagePoints((prev) =>
      prev.map((row) =>
        row.stage_code === stageCode ? { ...row, qualification_points: value } : row
      )
    )
  }

  const handleSavePots = async () => {
    if (!tournamentId) return

    setSavingPots(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { data: existingPotsData, error: existingPotsError } = await supabase
        .from('pots')
        .select('id')
        .eq('tournament_id', tournamentId)

      if (existingPotsError) throw existingPotsError

      const existingPotIds = new Set(((existingPotsData ?? []) as any[]).map((row) => row.id))
      const localPotIds = new Set(pots.map((pot) => pot.id))
      const potIdsToDelete = [...existingPotIds].filter((id) => !localPotIds.has(id))

      if (potIdsToDelete.length > 0) {
        const teamsToClear = teams
          .filter((team) => team.pot_id && potIdsToDelete.includes(team.pot_id))
          .map((team) => ({
            tournament_team_id: team.id,
            pot_id: null,
          }))

        if (teamsToClear.length > 0) {
          const { error: clearAssignmentsError } = await supabase.rpc('assign_pots_bulk', {
            p_tournament_id: tournamentId,
            p_assignments: teamsToClear,
          })

          if (clearAssignmentsError) throw clearAssignmentsError
        }

        const { error: deletePotsError } = await supabase
          .from('pots')
          .delete()
          .in('id', potIdsToDelete)
          .eq('tournament_id', tournamentId)

        if (deletePotsError) throw deletePotsError
      }

      const cleanedPots = pots.map((pot, index) => ({
        tournament_id: tournamentId,
        pot_number: toInteger(pot.pot_number, index + 1),
        name: pot.name.trim() || `Bombo ${index + 1}`,
        coefficient: toDecimal(pot.coefficient, 1),
      }))

      const { data: savedPots, error: potsError } = await supabase
        .from('pots')
        .upsert(cleanedPots, {
          onConflict: 'tournament_id,pot_number',
          defaultToNull: false,
        })
        .select('id, tournament_id, name, pot_number, coefficient')

      if (potsError) throw potsError

      const normalizedSavedPots: Pot[] = ((savedPots ?? []) as any[])
        .sort((a, b) => (a.pot_number ?? 0) - (b.pot_number ?? 0))
        .map((pot) => ({
          id: pot.id,
          name: pot.name ?? '',
          pot_number: pot.pot_number != null ? String(pot.pot_number) : '',
          coefficient: formatDecimalForInput(pot.coefficient),
        }))

      setPots(normalizedSavedPots)

      const savedPotIdByNumber = new Map(
        ((savedPots ?? []) as any[]).map((pot) => [String(pot.pot_number), pot.id])
      )

      const localPotNumberById = new Map(
        pots.map((pot, index) => [pot.id, String(toInteger(pot.pot_number, index + 1))])
      )

      const assignments = teams.map((team) => {
        if (!team.pot_id) {
          return {
            tournament_team_id: team.id,
            pot_id: null,
          }
        }

        const selectedPotNumber = localPotNumberById.get(team.pot_id)
        const stableSavedPotId = selectedPotNumber
          ? savedPotIdByNumber.get(selectedPotNumber) ?? null
          : null

        return {
          tournament_team_id: team.id,
          pot_id: stableSavedPotId,
        }
      })

      const { error: assignError } = await supabase.rpc('assign_pots_bulk', {
        p_tournament_id: tournamentId,
        p_assignments: assignments,
      })

      if (assignError) throw assignError

      await loadTournamentData(tournamentId)
      setSuccessMessage('Bombos y asignaciones guardados correctamente.')
    } catch (err: any) {
      setError(err.message ?? 'No se pudieron guardar los bombos.')
    } finally {
      setSavingPots(false)
    }
  }

  const handleSaveTournamentConfig = async () => {
    if (!tournamentId) return

    setSavingTournamentConfig(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { error: scoringError } = await supabase
        .from('tournament_scoring_settings')
        .upsert(
          {
            tournament_id: tournamentId,
            win_points: toInteger(scoringSettings.win_points, 3),
            draw_points: toInteger(scoringSettings.draw_points, 1),
          },
          { onConflict: 'tournament_id' }
        )

      if (scoringError) throw scoringError

      const stageRows = stagePoints.map((row) => ({
        tournament_id: tournamentId,
        stage_code: row.stage_code,
        stage_name: row.stage_name,
        qualification_points: toInteger(row.qualification_points, 0),
      }))

      const { error: stageError } = await supabase
        .from('tournament_stage_points')
        .upsert(stageRows, { onConflict: 'tournament_id,stage_code' })

      if (stageError) throw stageError

      await loadTournamentData(tournamentId)
      setSuccessMessage('Configuración del torneo guardada correctamente.')
    } catch (err: any) {
      setError(err.message ?? 'No se pudo guardar la configuración del torneo.')
    } finally {
      setSavingTournamentConfig(false)
    }
  }

  const handleImportMatches = async () => {
    setImportingMatches(true)
    setError(null)
    setSuccessMessage(null)

    try {
      if (!overrideCompetition.trim() || !overrideSeason.trim()) {
        throw new Error('Debes indicar campeonato y año.')
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('No hay sesión activa. Inicia sesión con el usuario admin.')
      }

      const body: any = {
        competition_code: overrideCompetition.trim(),
        season: Number(overrideSeason.trim()),
      }

      if (overrideName.trim()) {
        body.name = overrideName.trim()
      }

      if (tournamentId) {
        body.tournament_id = tournamentId
      }

      const { data, error } = await supabase.functions.invoke('import-tournament', {
        body,
      })

      if (error) {
        if ((error as any).name === 'FunctionsHttpError') {
          let detailedMessage = error.message ?? 'La Edge Function devolvió un error.'

          try {
            const payload = await (error as any).context.json()

            if (typeof payload?.details === 'string') {
              detailedMessage = payload.details
            } else if (payload?.details && typeof payload.details === 'object') {
              detailedMessage = JSON.stringify(payload.details, null, 2)
            } else if (typeof payload?.message === 'string') {
              detailedMessage = payload.message
            } else if (typeof payload?.error === 'string') {
              detailedMessage = payload.error
            } else {
              detailedMessage = JSON.stringify(payload, null, 2)
            }
          } catch {
            try {
              const rawText = await (error as any).context.text()
              if (rawText) detailedMessage = rawText
            } catch {
            }
          }

          throw new Error(detailedMessage)
        }

        throw error
      }

      if (data?.error) {
        throw new Error(data.details ?? data.message ?? data.error)
      }

      const newTournamentId = data?.tournament?.id ?? body.tournament_id ?? ''

      await loadTournaments()

      if (newTournamentId) {
        setTournamentId(newTournamentId)
        await loadTournamentData(newTournamentId)
        setOverrideName(data?.tournament?.name ?? overrideName)
      }

      setSuccessMessage(
        `Importación correcta. Torneo: ${data?.tournament?.name ?? 'ok'}. Partidos: ${data?.matchesImported ?? 0}`
      )
    } catch (err: any) {
      setError(err.message ?? 'No se pudieron importar los partidos.')
    } finally {
      setImportingMatches(false)
    }
  }

  const handleLoadMissingTeams = async () => {
    if (!tournamentId) {
      setError('Selecciona un torneo primero.')
      setSuccessMessage(null)
      return
    }

    setLoadingTeamsFromStaging(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { data, error } = await supabase.rpc('load_missing_teams_from_staging', {
        p_tournament_id: tournamentId,
      })

      if (error) throw error

      await loadTournamentData(tournamentId)
      setSuccessMessage(`Equipos cargados o actualizados: ${data ?? 0}`)
    } catch (err: any) {
      setError(err.message ?? 'No se pudieron cargar los equipos faltantes.')
    } finally {
      setLoadingTeamsFromStaging(false)
    }
  }

  const handleOpenTournament = async () => {
    if (!tournamentId) return

    setUpdatingStatus(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const { data, error } = await supabase.rpc('open_tournament', {
        p_tournament_id: tournamentId,
      })

      if (error) throw error

      await loadTournaments()
      await loadTournamentData(tournamentId)

      setSuccessMessage(`Torneo abierto correctamente: ${data?.name ?? 'ok'}`)
    } catch (err: any) {
      setError(err.message ?? 'No se pudo abrir el torneo.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div className="page page-admin">
      <div className="page-header">
        <h1>Panel admin</h1>
        <p className="page-header-subtitle">
          Configura torneos, bombos y puntuaciones desde un único panel.
        </p>
      </div>

      {loadingTournaments && <p className="muted">Cargando torneos...</p>}
      {error && <p className="error-text" style={{ whiteSpace: 'pre-wrap' }}>{error}</p>}
      {successMessage && <p className="success-text">{successMessage}</p>}

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Torneos</p>
            <h2 className="card-title">Seleccionar torneo</h2>
          </div>
        </div>

        {loadingTournaments ? (
          <p>Cargando torneos...</p>
        ) : (
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <div className="form-field">
              <label htmlFor="tournament-select">Torneo</label>
              <select
                id="tournament-select"
                value={tournamentId}
                onChange={(e) => setTournamentId(e.target.value)}
              >
                <option value="">Sin torneo seleccionado (usar campeonato + año)</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="secondary-btn" onClick={() => loadTournamentData()}>
                Cargar equipos
              </button>

              <button
                className="secondary-btn"
                onClick={handleLoadMissingTeams}
                disabled={!tournamentId || loadingTeamsFromStaging}
              >
                {loadingTeamsFromStaging ? 'Cargando equipos faltantes...' : 'Cargar equipos si faltan'}
              </button>
            </div>
          </div>
        )}

        {selectedTournament && (
          <div className="list-stack" style={{ marginTop: 8 }}>
            <p className="muted">
              <strong>Competition code:</strong> {selectedTournament.competition_code ?? '—'}
            </p>
            <p className="muted">
              <strong>Season year:</strong> {selectedTournament.season_year ?? '—'}
            </p>
            <p className="muted">
              <strong>Status:</strong> {selectedTournament.status}
            </p>

            {selectedTournament.status !== 'open' && (
              <div>
                <button
                  className="primary-btn"
                  onClick={handleOpenTournament}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? 'Abriendo torneo...' : 'Abrir torneo'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Puntuaciones</p>
            <h2 className="card-title">Configuración del torneo</h2>
          </div>
        </div>

        {!tournamentId ? (
          <p className="muted">Selecciona un torneo para configurar puntuaciones y fases.</p>
        ) : (
          <>
            <div className="form-grid" style={{ maxWidth: 700, marginBottom: 16 }}>
              <div className="form-field">
                <label>Puntos por victoria</label>
                <input
                  type="number"
                  step="1"
                  value={scoringSettings.win_points}
                  onChange={(e) => handleChangeScoring('win_points', e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div className="form-field">
                <label>Puntos por empate</label>
                <input
                  type="number"
                  step="1"
                  value={scoringSettings.draw_points}
                  onChange={(e) => handleChangeScoring('draw_points', e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>

            <h3 className="card-title" style={{ marginTop: 8 }}>Puntos por clasificar a cada fase</h3>

            <table className="table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Fase</th>
                  <th>Puntos</th>
                </tr>
              </thead>
              <tbody>
                {stagePoints.map((row) => (
                  <tr key={row.stage_code}>
                    <td>{row.stage_name}</td>
                    <td>
                      <input
                        type="number"
                        step="1"
                        value={row.qualification_points}
                        onChange={(e) => handleChangeStagePoints(row.stage_code, e.target.value)}
                        inputMode="numeric"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 12 }}>
              <button
                className="primary-btn"
                onClick={handleSaveTournamentConfig}
                disabled={savingTournamentConfig}
              >
                {savingTournamentConfig ? 'Guardando configuración...' : 'Guardar configuración del torneo'}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Bombos</p>
            <h2 className="card-title">Bombos manuales</h2>
            <p className="card-subtitle">
              Define bombos y multipliers, y asigna los equipos de forma manual.
            </p>
          </div>
        </div>

        {!tournamentId && <p className="muted">Selecciona un torneo existente para editar bombos.</p>}

        {tournamentId && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button className="secondary-btn" onClick={handleAddPot}>
                Añadir bombo
              </button>
            </div>

            <table className="table" style={{ marginBottom: 12 }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Número</th>
                  <th>Multiplicador</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pots.map((pot, index) => (
                  <tr key={pot.id}>
                    <td>
                      <input
                        type="text"
                        value={pot.name}
                        onChange={(e) => handleChangePotRow(index, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="1"
                        value={pot.pot_number}
                        onChange={(e) => handleChangePotRow(index, 'pot_number', e.target.value)}
                        inputMode="numeric"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={pot.coefficient}
                        onChange={(e) => handleChangePotRow(index, 'coefficient', e.target.value)}
                        inputMode="decimal"
                        placeholder="1,25"
                      />
                    </td>
                    <td>
                      <button className="ghost-btn" onClick={() => handleRemovePot(pot.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {teams.length === 0 && !loadingData && (
              <p className="muted">No hay equipos cargados para este torneo.</p>
            )}

            {teams.length > 0 && (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Equipo</th>
                      <th>Bombo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team) => (
                      <tr key={team.id}>
                        <td>{team.team_name}</td>
                        <td>
                          <select
                            value={team.pot_id ?? ''}
                            onChange={(e) => handleChangePotAssignment(team.id, e.target.value || null)}
                          >
                            <option value="">Sin bombo</option>
                            {pots
                              .slice()
                              .sort((a, b) => toInteger(a.pot_number, 0) - toInteger(b.pot_number, 0))
                              .map((pot) => (
                                <option key={pot.id} value={pot.id}>
                                  {pot.name} · x{pot.coefficient || '1'}
                                </option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: 12 }}>
                  <button
                    className="primary-btn"
                    onClick={handleSavePots}
                    disabled={savingPots || loadingData}
                  >
                    {savingPots ? 'Guardando...' : 'Guardar bombos y asignaciones'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Importación</p>
            <h2 className="card-title">Importar partidos</h2>
          </div>
        </div>

        <p className="muted">
          Indica campeonato, año y nombre. Si hay torneo seleccionado, lo actualiza e importa ahí.
          Si no hay torneo seleccionado, buscará torneo por campeonato + año; si existe lo actualiza,
          y si no existe lo crea e importará ahí.
        </p>

        <div className="form-grid" style={{ marginTop: 12, marginBottom: 12 }}>
          <div className="form-field">
            <label>Campeonato</label>
            <select
              value={overrideCompetition}
              onChange={(e) => setOverrideCompetition(e.target.value)}
            >
              <option value="">Selecciona campeonato</option>
              {COMPETITIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Año</label>
            <input
              value={overrideSeason}
              onChange={(e) => setOverrideSeason(e.target.value)}
              placeholder="2026"
              inputMode="numeric"
            />
          </div>

          <div className="form-field">
            <label>Nombre competición</label>
            <input
              value={overrideName}
              onChange={(e) => setOverrideName(e.target.value)}
              placeholder="World Cup 2026"
            />
          </div>
        </div>

        <button
          className="primary-btn"
          onClick={handleImportMatches}
          disabled={importingMatches}
        >
          {importingMatches ? 'Importando partidos...' : 'Importar partidos'}
        </button>
      </section>
    </div>
  )
}