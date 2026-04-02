import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const TOTAL_COUNTRIES = 270

interface UserNotchProps {
  user: User | null
  unlockedCount: number
  pinsCount: number
  isLoaded: boolean
}

function signIn() {
  supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
}

function signOut() {
  supabase.auth.signOut()
}

export default function UserNotch({ user, unlockedCount, pinsCount, isLoaded }: UserNotchProps) {
  const pct = Math.min((unlockedCount / TOTAL_COUNTRIES) * 100, 100)

  // ── Logged-out pill ───────────────────────────────────
  if (!user) {
    return (
      <div
        onClick={signIn}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] flex items-center gap-2 px-4 py-2.5 rounded-full select-none cursor-pointer"
        style={{ background: '#2C2C2C', boxShadow: '0 2px 14px rgba(0,0,0,0.40)' }}
      >
        <span style={{ fontSize: '14px' }}>✈️</span>
        <span className="font-mono text-xs font-semibold text-white tracking-tight">
          Iniciar Sesión
        </span>
      </div>
    )
  }

  // ── Logged-in pill ────────────────────────────────────
  const avatar = user.user_metadata?.avatar_url as string | undefined
  const username = user.email?.split('@')[0] ?? 'viajero'

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] flex items-center gap-3 pl-2 pr-3 py-2 rounded-full select-none"
      style={{ background: '#2C2C2C', boxShadow: '0 2px 14px rgba(0,0,0,0.40)' }}
    >
      {/* Avatar */}
      {avatar ? (
        <img
          src={avatar}
          alt={username}
          referrerPolicy="no-referrer"
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          style={{ border: '2px solid #3C3C3C' }}
        />
      ) : (
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-mono text-sm font-bold text-white"
          style={{ background: '#4FB3A9', border: '2px solid #3C3C3C' }}
        >
          {username[0].toUpperCase()}
        </div>
      )}

      {/* Info */}
      <div className="flex flex-col gap-[5px]">
        <span className="font-mono text-xs font-semibold text-white leading-none tracking-tight">
          @{username}
        </span>

        <div className="w-32 h-[5px] rounded-full overflow-hidden" style={{ background: '#444' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: '#4FB3A9', transition: 'width 0.6s ease' }}
          />
        </div>

        <span className="font-mono leading-none" style={{ fontSize: '10px', color: '#777' }}>
          <span style={{ color: '#4FB3A9', fontWeight: 600 }}>{isLoaded ? pinsCount : '—'}</span>
          <span> pines · </span>
          <span style={{ color: '#4FB3A9', fontWeight: 600 }}>{isLoaded ? unlockedCount : '—'}</span>
          <span> / {TOTAL_COUNTRIES} países</span>
        </span>
      </div>

      {/* Logout */}
      <button
        onClick={signOut}
        className="ml-1 flex-shrink-0 cursor-pointer"
        title="Cerrar sesión"
        style={{ color: '#555', lineHeight: 1 }}
        onMouseOver={(e) => (e.currentTarget.style.color = '#aaa')}
        onMouseOut={(e) => (e.currentTarget.style.color = '#555')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  )
}
