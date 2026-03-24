import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Package, Bell, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Sidebar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/subscriptions', label: 'Subscriptions', icon: Package },
    { path: '/reminders', label: 'Reminders', icon: Bell },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  // Get user display info — prefer profile data, fall back to Google auth metadata
  const fullName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url
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
    <div className="w-64 h-screen bg-[#111827] text-white flex flex-col">
      {/* Logo Section */}
      <div className="border-b border-white/[0.08] p-6 flex items-center gap-3">
        <img src="/snipcat-logo.png" alt="Snipcat" className="w-9 h-9 object-contain invert" />
        <h1 className="text-xl font-bold tracking-tight">Snipcat</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-[#F97316]/15 text-[#F97316] font-semibold'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
              }`
            }
          >
            <Icon size={20} />
            <span className="text-sm">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-white/[0.08] p-4">
        <div className="flex items-center gap-3 px-2 py-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-white/10"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#F97316] flex items-center justify-center font-semibold text-white text-sm">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{fullName}</p>
            <p className="text-xs text-white/40">{profile?.plan === 'pro' ? '✨ Pro Plan' : 'Free Plan'}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="mt-2 w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/40 hover:text-white hover:bg-white/[0.04] transition-all duration-200 text-sm"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}
