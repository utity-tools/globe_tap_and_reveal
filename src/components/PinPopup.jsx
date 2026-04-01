// Uses inline styles to guarantee correct rendering inside Leaflet's popup container

export default function PinPopup({ pin, onDelete }) {
  return (
    <div style={{ minWidth: '170px', maxWidth: '230px', fontFamily: 'ui-monospace, monospace' }}>
      {pin.photo_url && (
        <img
          src={pin.photo_url}
          alt={pin.title}
          style={{
            width: '100%',
            height: '110px',
            objectFit: 'cover',
            borderRadius: '4px',
            marginBottom: '8px',
            display: 'block',
          }}
        />
      )}

      <p style={{ color: '#f3f4f6', fontWeight: '500', fontSize: '13px', margin: '0 0 4px' }}>
        {pin.title}
      </p>

      {pin.comment && (
        <p style={{ color: '#9ca3af', fontSize: '11px', margin: '0 0 6px', lineHeight: '1.4' }}>
          {pin.comment}
        </p>
      )}

      <p style={{ color: '#374151', fontSize: '10px', margin: '0 0 10px', letterSpacing: '0.02em' }}>
        {Number(pin.lat).toFixed(5)}, {Number(pin.lng).toFixed(5)}
      </p>

      <button
        onClick={() => onDelete(pin.id)}
        style={{
          display: 'block',
          width: '100%',
          padding: '4px 0',
          background: 'transparent',
          border: '1px solid #3f1f1f',
          borderRadius: '4px',
          color: '#f87171',
          fontSize: '11px',
          cursor: 'pointer',
          transition: 'background 0.15s',
          fontFamily: 'inherit',
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = '#2d1515')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        Delete
      </button>
    </div>
  )
}
