import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Profile = {
  id: string
  username: string | null
  display_name: string | null
}

type PorraSummary = {
  tournament_id: string
  tournament_name: string
  tournament_status: string
  total_points: number | null
}

function formatTournamentStatus(status: string) {
  const normalized = status?.toLowerCase?.() ?? ''

  switch (normalized) {
    case 'open':
      return 'Abierto'
    case 'live':
      return 'En juego'
    case 'locked':
      return 'Cerrado'
    case 'finished':
      return 'Finalizado'
    case 'draft':
      return 'Borrador'
    default:
      return status
  }
}

function formatPoints(value: number | null) {
  return typeof value === 'number' ? value.toString() : '0'
}

export function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [porras, setPorras] = useState<PorraSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError

        const user = authData.user
        if (!user) {
          setLoading(false)
          return
        }

        setUserId(user.id)
        setEmail(user.email ?? null)

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) throw profileError

        setProfile(profileData)
        setUsername(profileData?.username ?? '')

        const { data: porrasData, error: porrasError } = await supabase
          .from('player_entries_with_points')
          .select('tournament_id, tournament_name, tournament_status, total_points')
          .eq('player_id', user.id)
          .order('tournament_name', { ascending: true })

        if (porrasError) throw porrasError

        setPorras((porrasData ?? []) as PorraSummary[])
      } catch (err: any) {
        setError(err.message ?? 'No se pudo cargar tu perfil.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const handleUsernameSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setUsernameMessage(null)
    setUsernameError(null)

    const normalizedUsername = username.trim()

    if (!userId) {
      setUsernameError('No hay usuario autenticado.')
      return
    }

    if (!normalizedUsername) {
      setUsernameError('El nombre de usuario no puede estar vacío.')
      return
    }

    if (normalizedUsername.length < 3) {
      setUsernameError('El nombre de usuario debe tener al menos 3 caracteres.')
      return
    }

    setSavingUsername(true)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          username: normalizedUsername,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('id, username, display_name')
        .maybeSingle()

      if (error) throw error

      setProfile(data)
      setUsername(data?.username ?? normalizedUsername)
      setUsernameMessage('Nombre de usuario actualizado correctamente.')
    } catch (err: any) {
      const isDuplicateUsername =
        err?.code === '23505' ||
        err?.message?.includes('profiles_username_key') ||
        err?.message?.toLowerCase?.().includes('duplicate key value')

      if (isDuplicateUsername) {
        setUsernameError('Ese nombre de usuario ya está en uso. Prueba con otro.')
      } else {
        setUsernameError(
          err?.message ?? 'No se pudo actualizar el nombre de usuario.'
        )
      }
    } finally {
      setSavingUsername(false)
    }
  }

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)
    setPasswordError(null)

    if (!password) {
      setPasswordError('La nueva contraseña no puede estar vacía.')
      return
    }

    if (password.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }

    setSavingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) throw error

      setPassword('')
      setPasswordConfirm('')
      setPasswordMessage('Contraseña actualizada correctamente.')
    } catch (err: any) {
      setPasswordError(
        err?.message ?? 'No se pudo actualizar la contraseña.'
      )
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="page page-profile">
      <div className="page-header">
        <h1>Perfil</h1>
        <p className="page-header-subtitle">
          Datos básicos de tu cuenta y resumen de tus porras.
        </p>
      </div>

      {loading && <p className="muted">Cargando perfil...</p>}
      {error && <p className="error-text">{error}</p>}

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <div>
            <p className="eyebrow">Cuenta</p>
            <h2 className="card-title">
              {profile?.display_name || profile?.username || 'Sin nombre'}
            </h2>
          </div>
        </div>

        <div className="list-stack">
          <p className="muted">
            Email: <strong>{email ?? '—'}</strong>
          </p>
          <p className="muted">
            Usuario: <strong>{profile?.username ?? '—'}</strong>
          </p>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <div>
            <p className="eyebrow">Ajustes</p>
            <h2 className="card-title">Cambiar nombre de usuario</h2>
          </div>
        </div>

        <form onSubmit={handleUsernameSave} className="list-stack">
          <label className="field">
            <span className="muted">Nuevo nombre de usuario</span>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu nombre de usuario"
            />
          </label>

          {usernameError && <p className="error-text">{usernameError}</p>}
          {usernameMessage && <p className="success-text">{usernameMessage}</p>}

          <div>
            <button
              className="button-primary"
              type="submit"
              disabled={savingUsername}
            >
              {savingUsername ? 'Guardando...' : 'Guardar nombre de usuario'}
            </button>
          </div>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <div>
            <p className="eyebrow">Seguridad</p>
            <h2 className="card-title">Cambiar contraseña</h2>
          </div>
        </div>

        <form onSubmit={handlePasswordSave} className="list-stack">
          <label className="field">
            <span className="muted">Nueva contraseña</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </label>

          <label className="field">
            <span className="muted">Confirmar nueva contraseña</span>
            <input
              className="input"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Repite la nueva contraseña"
            />
          </label>

          {passwordError && <p className="error-text">{passwordError}</p>}
          {passwordMessage && <p className="success-text">{passwordMessage}</p>}

          <div>
            <button
              className="button-primary"
              type="submit"
              disabled={savingPassword}
            >
              {savingPassword ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </section>

      {porras.length > 0 ? (
        <section className="card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Resumen</p>
              <h2 className="card-title">Tus porras por torneo</h2>
            </div>
          </div>

          <div className="profile-porras-mobile">
            {porras.map((p) => (
              <article key={p.tournament_id} className="profile-porra-item">
                <div className="profile-porra-main">
                  <h3 className="profile-porra-title">{p.tournament_name}</h3>
                  <p className="profile-porra-status">
                    {formatTournamentStatus(p.tournament_status)}
                  </p>
                </div>

                <div className="profile-porra-points">
                  <span className="profile-porra-points-value">
                    {formatPoints(p.total_points)}
                  </span>
                  <span className="profile-porra-points-label">pts</span>
                </div>
              </article>
            ))}
          </div>

          <div className="profile-porras-desktop">
            <table className="table">
              <thead>
                <tr>
                  <th>Torneo</th>
                  <th>Estado</th>
                  <th>Puntos</th>
                </tr>
              </thead>
              <tbody>
                {porras.map((p) => (
                  <tr key={p.tournament_id}>
                    <td>{p.tournament_name}</td>
                    <td>{formatTournamentStatus(p.tournament_status)}</td>
                    <td>{formatPoints(p.total_points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        !loading && (
          <section className="card">
            <p className="muted">Todavía no tienes porras registradas.</p>
          </section>
        )
      )}
    </div>
  )
}