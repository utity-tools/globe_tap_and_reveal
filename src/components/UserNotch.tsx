const TOTAL_COUNTRIES = 270

interface UserNotchProps {
  unlockedCount: number
  pinsCount: number
  isLoaded: boolean
}

export default function UserNotch({ unlockedCount, pinsCount, isLoaded }: UserNotchProps) {
  const pct = Math.min((unlockedCount / TOTAL_COUNTRIES) * 100, 100)

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] flex items-center gap-3 px-3 py-2 rounded-full select-none"
      style={{ background: '#2C2C2C', boxShadow: '0 2px 14px rgba(0,0,0,0.40)' }}
    >
      {/* Dodo avatar */}
      <img
        src="/dodo_avatar.png"
        alt="Globy"
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        style={{ border: '2px solid #3C3C3C' }}
      />

      {/* Info block */}
      <div className="flex flex-col gap-[5px]">
        <span className="font-mono text-xs font-semibold text-white leading-none tracking-tight">
          @globy_admin
        </span>

        {/* Progress bar */}
        <div className="w-32 h-[5px] rounded-full overflow-hidden" style={{ background: '#444' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: '#4FB3A9', transition: 'width 0.6s ease' }}
          />
        </div>

        {/* Counters */}
        <span className="font-mono leading-none" style={{ fontSize: '10px', color: '#777' }}>
          <span style={{ color: '#4FB3A9', fontWeight: 600 }}>{isLoaded ? pinsCount : '—'}</span>
          <span> pines · </span>
          <span style={{ color: '#4FB3A9', fontWeight: 600 }}>{isLoaded ? unlockedCount : '—'}</span>
          <span> / {TOTAL_COUNTRIES} países</span>
        </span>
      </div>
    </div>
  )
}
