import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

type AdminRouteProps = {
  userEmail: string | null
  children: ReactNode
}



const ADMIN_EMAIL = 'yry.rdk.lvrz@gmail.com'.trim().toLowerCase()

export function AdminRoute({ userEmail, children }: AdminRouteProps) {
  const normalizedEmail = userEmail?.trim().toLowerCase() ?? null

  if (normalizedEmail !== ADMIN_EMAIL) {
    return <Navigate to="/competitions" replace />
  }

  return <>{children}</>
}
