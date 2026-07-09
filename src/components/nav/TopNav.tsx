import { NavLink } from 'react-router-dom'

type TopNavProps = {
  onLogout: () => void | Promise<void>
  userEmail?: string | null
}

const ADMIN_EMAIL = 'yry.rdk.lvrz@gmail.com'

export function TopNav({ onLogout, userEmail }: TopNavProps) {
  const normalizedEmail = userEmail?.trim().toLowerCase() ?? ''
  const isAdmin = normalizedEmail === ADMIN_EMAIL

  const navItems = [
    { to: '/me', label: 'Mis porras' },
    { to: '/competitions', label: 'Competiciones' },
    { to: '/ranking', label: 'Ranking' },
    { to: '/profile', label: 'Perfil' },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <header className="top-nav-wrap">
      <div className="top-nav">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">P</div>
          <div className="brand-copy">
            <span className="brand-kicker">Tu app de porras</span>
            <span className="brand-title">Porras</span>
          </div>
        </div>

        <nav className="top-nav-links" aria-label="Navegación principal">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link-active' : 'nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <button className="nav-logout-btn" onClick={onLogout}>
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}