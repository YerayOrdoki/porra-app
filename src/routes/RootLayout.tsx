import { Outlet } from 'react-router-dom'
import { BottomNav } from '../components/nav/BottomNav'

export function RootLayout() {
  return (
    <div className="app-root">
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
