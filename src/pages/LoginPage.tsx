import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
          setMessage('Cuenta creada. Revisa tu correo y confirma el acceso.')
        } else {
          setMessage('Cuenta creada correctamente.')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) throw error
        if (!data.user) throw new Error('No se pudo iniciar sesión.')
      }
    } catch (err: any) {
      setError(err.message ?? 'Error de autenticación.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-card-head">
          <div className="brand auth-brand">
            <div className="brand-mark">P</div>
            <div className="brand-copy">
              <span className="brand-kicker">Fantasy</span>
              <span className="brand-title">La Porra</span>
            </div>
          </div>

          <div className="auth-copy">
            <p className="eyebrow">{mode === 'login' ? 'Acceso' : 'Registro'}</p>
            <h1>{mode === 'login' ? 'Entrar a tu cuenta' : 'Crear cuenta'}</h1>
            <p className="page-header-subtitle">
              {mode === 'login'
                ? 'Accede para ver tus competiciones, tu porra y la clasificación.'
                : 'Crea una cuenta para participar en torneos y guardar tus selecciones.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-grid auth-form">
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="Introduce tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="error-text">{error}</p>}
          {message && <p className="success-text">{message}</p>}

          <div className="auth-actions">
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading
                ? 'Cargando...'
                : mode === 'login'
                ? 'Entrar'
                : 'Crear cuenta'}
            </button>

            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError(null)
                setMessage(null)
              }}
            >
              {mode === 'login'
                ? '¿No tienes cuenta? Regístrate'
                : '¿Ya tienes cuenta? Entrar'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}