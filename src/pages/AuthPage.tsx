//AuthPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export function AuthPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (!email.trim()) {
        throw new Error('Introduce tu email.')
      }

      if (!password.trim()) {
        throw new Error('Introduce tu contraseña.')
      }

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })

        if (error) throw error

        if (data.user && !data.session) {
          setMessage('Cuenta creada. Revisa tu correo y confirma el acceso antes de entrar.')
        } else {
          setMessage('Cuenta creada correctamente.')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) throw error

        if (!data.user) {
          throw new Error('No se pudo iniciar sesión.')
        }

        navigate('/', { replace: true })
      }
    } catch (err: any) {
      setError(err?.message ?? 'Ha ocurrido un error al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</h1>

        <p className="muted">
          {mode === 'login'
            ? 'Accede con tu cuenta para entrar en la porra.'
            : 'Crea una cuenta para participar en la porra.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            required
            placeholder="Contraseña"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="error-text">{error}</p>}
          {message && <p className="success-text">{message}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>

        <button
          className="link-btn"
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError(null)
            setMessage(null)
          }}
        >
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entrar'}
        </button>
      </div>
    </div>
  )
}