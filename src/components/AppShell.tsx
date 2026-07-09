import type { ReactNode } from 'react'
import { BottomNav } from './nav/BottomNav'
import { TopNav } from './nav/TopNav'

type AppShellProps = {
  children: ReactNode
  onLogout: () => void | Promise<void>
  userEmail?: string | null
}

export function AppShell({ children, onLogout, userEmail }: AppShellProps) {
  return (
    <div className="app-shell">
      <TopNav onLogout={onLogout} userEmail={userEmail} />

      <main className="app-main" aria-label="Contenido principal">
        {children}
      </main>

      <BottomNav />
    </div>
  )
}