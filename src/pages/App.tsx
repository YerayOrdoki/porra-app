import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

import { AppShell } from '../components/AppShell'
import { AdminRoute } from '../components/AdminRoute'

import { LoginPage } from './LoginPage'
import { CompetitionsPage } from './CompetitionsPage'
import { CompetitionPage } from './CompetitionPage'
import { MyPorrasPage } from './MyPorrasPage'
import { MyPorraPage } from './MyPorraPage'
import { LeaderboardPage } from './LeaderboardPage'
import { AdminPage } from './AdminPage'
import { ProfilePage } from './ProfilePage'

function App() {
  const [session, setSession] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Cargando aplicación...</p>
      </div>
    )
  }

  const userEmail = session?.user?.email ?? null

  return (
    <BrowserRouter>
      {!session ? (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <AppShell onLogout={handleLogout} userEmail={userEmail}>
          <Routes>
            <Route path="/" element={<Navigate to="/competitions" replace />} />
            <Route path="/competitions" element={<CompetitionsPage />} />
            <Route path="/competition/:id" element={<CompetitionPage />} />
            <Route path="/me" element={<MyPorrasPage />} />
            <Route path="/me/:tournamentId" element={<MyPorraPage />} />
            <Route path="/ranking" element={<LeaderboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute userEmail={userEmail}>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route path="*" element={<Navigate to="/competitions" replace />} />
          </Routes>
        </AppShell>
      )}
    </BrowserRouter>
  )
}

export default App