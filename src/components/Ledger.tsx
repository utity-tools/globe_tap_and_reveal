import type { Pin } from '../types'

interface LedgerProps {
  pins: Pin[]
  onClose: () => void
  onFlyTo: (pin: Pin) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function Ledger({ pins, onClose, onFlyTo }: LedgerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-[1500]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-4 top-4 bottom-4 w-80 z-[2000] flex flex-col rounded-[1.5rem] overflow-hidden bg-[#F8F5EC] border border-[#DDD9C8] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDD9C8]">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E07A3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <span className="font-mono text-sm font-semibold text-[#3C3528]">Diario de viajes</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#8C7F6E] hover:text-[#3C3528] text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Count */}
        <div className="px-5 py-2 border-b border-[#EDE9DF]">
          <span className="font-mono text-xs text-[#8C7F6E]">
            {pins.length === 0
              ? 'Ningún pin todavía'
              : `${pins.length} ${pins.length === 1 ? 'lugar' : 'lugares'}`}
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {pins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C8BFB0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" />
              </svg>
              <p className="font-mono text-xs text-[#A09080]">
                Mantén pulsado el mapa para añadir tu primer pin.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#EDE9DF]">
              {pins.map((pin) => (
                <li key={pin.id} className="px-5 py-3 flex flex-col gap-1">
                  {/* Title */}
                  <span className="font-mono text-sm font-semibold text-[#3C3528] truncate">
                    {pin.title || `${pin.lat.toFixed(3)}, ${pin.lng.toFixed(3)}`}
                  </span>

                  {/* Date + coords */}
                  <span className="font-mono text-[10px] text-[#A09080]">
                    {formatDate(pin.created_at)} · {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                  </span>

                  {/* Comment snippet */}
                  {pin.comment && (
                    <span className="font-mono text-xs text-[#7A6F60] line-clamp-2">
                      {pin.comment}
                    </span>
                  )}

                  {/* Action */}
                  <button
                    onClick={() => { onFlyTo(pin); onClose() }}
                    className="mt-1 self-start font-mono text-[11px] text-[#5B9FD4] hover:text-[#3A7FB8] underline underline-offset-2 cursor-pointer"
                  >
                    Ver en mapa →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
