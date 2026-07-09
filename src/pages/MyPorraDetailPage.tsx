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

export function MyPorraDetailPage() {
  const { tournamentId } = useParams()

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
        if (!tournamentId) {
          throw new Error('Falta tournamentId en la ruta.')
        }

        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError

        const currentUser = authData.user
        if (!currentUser) {
          setUserId(null)
          setTournament(null)
          return
        }

        setUserId(currentUser.id)

        const { data: t, error: tErr } = await supabase
          .from('tournaments')
          .select('id, name, status, created_at')
          .eq('id', tournamentId)
          .maybeSingle()

        if (tErr) throw tErr
        if (!t) throw new Error('No se encontró el torneo.')

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
        setError(err.message ?? 'No se pudo cargar la porra.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [tournamentId])

  const editable = useMemo(() => {
    return !!tournament && tournament.status === 'open' && !existingEntry
  }, [tournament, existingEntry])

  const complete = useMemo(() => {
    return pots.length > 0 && pots.every((pot) => !!selections[pot.id])
  }, [pots, selections])

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
    if (!editable || !tournament || !userId) return

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

      setSuccessMessage('Selecciones guardadas correctamente.')
    } catch (err: any) {
      setError(err.message ?? 'No se pudieron guardar las selecciones.')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleConfirmEntry = async () => {
    if (!editable || !tournament || !userId) return

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

      const { data: rpcData, error: rpcError } = await supabase.rpc('create_player_entry', {
        tournament_uuid: tournament.id,
        player_uuid: userId,
      })

      if (rpcError) throw rpcError

      setExistingEntry((rpcData as PlayerEntry) ?? null)
      setSuccessMessage('Porra confirmada correctamente. Ya no se puede editar.')
    } catch (err: any) {
      setError(err.message ?? 'No se pudo confirmar la porra.')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 16 }}>
        <h1>Mi porra</h1>
        <p>Cargando...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main style={{ padding: 16 }}>
        <h1>Mi porra</h1>
        <p>{error}</p>
      </main>
    )
  }

  if (!tournament) {
    return (
      <main style={{ padding: 16 }}>
        <h1>Mi porra</h1>
        <p>No se encontró el torneo.</p>
      </main>
    )
  }

  return (
    <main style={{ padding: 16 }}>
      <h1>Mi porra</h1>

      <p>
        Torneo: <strong>{tournament.name}</strong>
      </p>

      <p>
        Estado del torneo: <strong>{tournament.status}</strong>
      </p>

      {tournament.status !== 'open' && (
        <p>La edición está cerrada para este torneo.</p>
      )}

      {existingEntry && (
        <p>Tu porra ya está confirmada y bloqueada.</p>
      )}

      {successMessage && <p>{successMessage}</p>}

      {pots.map((pot) => (
        <div
          key={pot.id}
          style={{ marginBottom: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}
        >
          <h2>{pot.name}</h2>

          <select
            value={selections[pot.id] ?? ''}
            disabled={!editable}
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
      ))}

      {editable && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={handleSaveDraft} disabled={savingDraft || confirming}>
            {savingDraft ? 'Guardando...' : 'Guardar selección'}
          </button>

          <button onClick={handleConfirmEntry} disabled={savingDraft || confirming}>
            {confirming ? 'Confirmando...' : 'Confirmar porra'}
          </button>
        </div>
      )}
    </main>
  )
}