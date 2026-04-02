import type { CSSProperties } from 'react'
import type { Pin } from '../types'

interface PinPopupProps {
  pin: Pin
  onDelete: (id: string) => void
}

// Uses inline styles to guarantee correct rendering inside Leaflet's popup container

const styles = {
  wrapper: { minWidth: '170px', maxWidth: '230px', fontFamily: 'ui-monospace, monospace' } satisfies CSSProperties,
  photo: { width: '100%', height: '110px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px', display: 'block' } satisfies CSSProperties,
  title: { color: '#3C3528', fontWeight: '600', fontSize: '13px', margin: '0 0 4px' } satisfies CSSProperties,
  comment: { color: '#7A6F60', fontSize: '11px', margin: '0 0 6px', lineHeight: '1.4' } satisfies CSSProperties,
  coords: { color: '#A09080', fontSize: '10px', margin: '0 0 10px', letterSpacing: '0.02em' } satisfies CSSProperties,
  deleteBtn: {
    display: 'block',
    width: '100%',
    padding: '4px 0',
    background: 'transparent',
    border: '1px solid #E0CFC0',
    borderRadius: '6px',
    color: '#C0624A',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } satisfies CSSProperties,
} as const

export default function PinPopup({ pin, onDelete }: PinPopupProps) {
  return (
    <div style={styles.wrapper}>
      {pin.photo_url && (
        <img src={pin.photo_url} alt={pin.title} style={styles.photo} />
      )}

      <p style={styles.title}>{pin.title}</p>

      {pin.comment && (
        <p style={styles.comment}>{pin.comment}</p>
      )}

      <p style={styles.coords}>
        {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
      </p>

      <button
        onClick={() => onDelete(pin.id)}
        style={styles.deleteBtn}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#FAF0EB'
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }}
      >
        Delete
      </button>
    </div>
  )
}
