import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Package, Bell, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const CatLogo = () => (
  <svg viewBox="0 0 58 42" fill="none" className="w-9 h-7">
    <g transform="translate(8,26) scale(0.28)">
      <circle cx="-6" cy="6" r="5" stroke="#F97316" strokeWidth="3" fill="none" />
      <line x1="-4" y1="2" x2="6" y2="-10" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
      <circle cx="6" cy="6" r="5" stroke="#F97316" strokeWidth="3" fill="none" />
      <line x1="4" y1="2" x2="-6" y2="-10" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
    </g>
    <g transform="translate(18, 0)">
      <path d="M8 16L4 3L14 12" fill="white" />
      <path d="M32 16L36 3L26 12" fill="white" />
      <ellipse cx="20" cy="24" rx="14" ry="13" fill="white" />
      <ellipse cx="15" cy="22" rx="2.2" ry="2.6" fill="#F97316" />
      <ellipse cx="25" cy="22" rx="2.2" ry="2.6" fill="#F97316" />
      <path d="M18.8 27L20 28.8L21.2 27Z" fill="#F97316" />
    </g>
  </svg>
)

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/subscriptions', label: 'Subscriptions', icon: Package },
    { path: '/reminders', label: 'Reminders', icon: Bell },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  // Get user display info from Google auth metadata
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const avatarUrl = user?.user_metadata?.avatar_url
  const initials = fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="w-64 h-screen bg-gray-900 text-white flex flex-col">
      {/* Logo Section */}
      <div className="border-b border-white/10 p-6 flex items-center gap-3">
        <CatLogo />
        <h1 className="text-xl font-bold">SnipKitty</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 px-2 py-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="w-10 h-10 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center font-semibold text-white text-sm">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{fullName}</p>
            <p className="text-xs text-white/60">Free Plan</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="mt-2 w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors text-sm"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}
