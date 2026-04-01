import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import PinForm from './PinForm'
import PinPopup from './PinPopup'

const COUNTRIES_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'

// ── Styles ────────────────────────────────────────────────
const getCountryStyle = (visited) => ({
  fillColor: visited ? '#7c3aed' : '#1e293b',
  fillOpacity: visited ? 0.6 : 0.3,
  color: visited ? '#a78bfa' : '#2d3f55',
  weight: visited ? 1 : 0.5,
})

const pinIcon = L.divIcon({
  html: `<div style="
    width:10px;height:10px;
    background:#7c3aed;
    border:2px solid #a78bfa;
    border-radius:50%;
    box-shadow:0 0 8px rgba(124,58,237,0.9),0 0 16px rgba(124,58,237,0.4)
  "></div>`,
  className: '',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
})

// ── Long-press / right-click handler ─────────────────────
function MapInteractions({ onLongPress }) {
  const timer = useRef(null)
  const startPixel = useRef(null)
  const startLatlng = useRef(null)

  useMapEvents({
    // Right-click on desktop / long-press on mobile
    contextmenu(e) {
      e.originalEvent.preventDefault()
      clearTimeout(timer.current)
      onLongPress(e.latlng)
    },
    // Long hold on desktop (700 ms, no drag)
    mousedown(e) {
      if (e.originalEvent.button !== 0) return
      startPixel.current = { x: e.originalEvent.clientX, y: e.originalEvent.clientY }
      startLatlng.current = e.latlng
      timer.current = setTimeout(() => onLongPress(startLatlng.current), 700)
    },
    mouseup() {
      clearTimeout(timer.current)
      startPixel.current = null
    },
    mousemove(e) {
      if (!startPixel.current) return
      const dx = e.originalEvent.clientX - startPixel.current.x
      const dy = e.originalEvent.clientY - startPixel.current.y
      if (dx * dx + dy * dy > 25) clearTimeout(timer.current) // >5 px → cancel
    },
    dragstart() {
      clearTimeout(timer.current)
      startPixel.current = null
    },
  })
  return null
}

// ── Main component ────────────────────────────────────────
export default function Map() {
  const [geoData, setGeoData] = useState(null)
  const [visitedSet, setVisitedSet] = useState(new Set())
  const [pins, setPins] = useState([])
  const [pinForm, setPinForm] = useState(null) // latlng | null

  const geoJsonRef = useRef(null)
  // Always-fresh refs — avoids stale closures in Leaflet callbacks
  const visitedRef = useRef(new Set())
  const clickHandlerRef = useRef(null)

  // ── Sync visitedRef + update map layer styles ──────────
  useEffect(() => {
    visitedRef.current = visitedSet
    if (!geoJsonRef.current) return
    geoJsonRef.current.eachLayer((layer) => {
      const code = layer.feature?.properties?.ISO_A3
      if (code) layer.setStyle(getCountryStyle(visitedSet.has(code)))
    })
  }, [visitedSet])

  // ── Load GeoJSON ───────────────────────────────────────
  useEffect(() => {
    fetch(COUNTRIES_URL)
      .then((r) => r.json())
      .then(setGeoData)
  }, [])

  // ── Load initial Supabase data ─────────────────────────
  useEffect(() => {
    supabase
      .from('visited_countries')
      .select('country_code')
      .then(({ data }) => {
        if (data) setVisitedSet(new Set(data.map((r) => r.country_code)))
      })

    supabase
      .from('pins')
      .select('*')
      .then(({ data }) => {
        if (data) setPins(data)
      })
  }, [])

  // ── Realtime: pins channel ─────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('pins-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pins' },
        ({ eventType, new: n, old: o }) => {
          if (eventType === 'INSERT') setPins((prev) => [...prev, n])
          else if (eventType === 'DELETE') setPins((prev) => prev.filter((p) => p.id !== o.id))
          else if (eventType === 'UPDATE') setPins((prev) => prev.map((p) => (p.id === n.id ? n : p)))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // ── Click country → toggle visited ────────────────────
  const handleCountryClick = useCallback(async (feature) => {
    const code = feature.properties.ISO_A3
    const name = feature.properties.ADMIN

    if (visitedRef.current.has(code)) {
      await supabase.from('visited_countries').delete().eq('country_code', code)
      setVisitedSet((prev) => {
        const next = new Set(prev)
        next.delete(code)
        return next
      })
    } else {
      const { error } = await supabase
        .from('visited_countries')
        .insert({ country_code: code, country_name: name })
      if (!error) setVisitedSet((prev) => new Set([...prev, code]))
    }
  }, [])

  // Keep ref fresh so Leaflet callbacks never see a stale closure
  clickHandlerRef.current = handleCountryClick

  // ── GeoJSON callbacks (stable refs, use *Ref inside) ──
  const onEachCountry = useCallback((feature, layer) => {
    layer.on({
      // Stop propagation so long-press timer doesn't fire on country clicks
      mousedown: (e) => L.DomEvent.stopPropagation(e),
      click: () => clickHandlerRef.current(feature),
      mouseover: () =>
        layer.setStyle({
          fillOpacity: visitedRef.current.has(feature.properties.ISO_A3) ? 0.85 : 0.5,
        }),
      mouseout: () =>
        layer.setStyle(getCountryStyle(visitedRef.current.has(feature.properties.ISO_A3))),
    })
  }, [])

  const countryStyle = useCallback(
    (feature) => getCountryStyle(visitedRef.current.has(feature.properties.ISO_A3)),
    []
  )

  // ── Delete pin ─────────────────────────────────────────
  const handleDeletePin = useCallback(async (id) => {
    await supabase.from('pins').delete().eq('id', id)
    setPins((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return (
    <div className="relative w-full h-screen bg-[#0a0a0f]">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" />

        {geoData && (
          <GeoJSON
            ref={geoJsonRef}
            data={geoData}
            style={countryStyle}
            onEachFeature={onEachCountry}
          />
        )}

        <MapInteractions onLongPress={setPinForm} />

        {pins.map((pin) => (
          <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={pinIcon}>
            <Popup>
              <PinPopup pin={pin} onDelete={handleDeletePin} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* ── Stats HUD ── */}
      <div className="absolute top-4 left-4 z-[1000] bg-black/60 border border-[#1e1e2a] rounded px-3 py-2 backdrop-blur-sm select-none">
        <p className="font-mono text-xs leading-relaxed">
          <span className="text-[#a78bfa] font-medium">{visitedSet.size}</span>
          <span className="text-[#4b5563]"> countries · </span>
          <span className="text-[#a78bfa] font-medium">{pins.length}</span>
          <span className="text-[#4b5563]"> pins</span>
        </p>
      </div>

      {/* ── Help hint ── */}
      <div className="absolute bottom-4 right-4 z-[1000] text-right select-none">
        <p className="font-mono text-[10px] text-[#374151]">click to mark visited</p>
        <p className="font-mono text-[10px] text-[#374151]">right-click / hold to drop pin</p>
      </div>

      {pinForm && (
        <PinForm
          latlng={pinForm}
          onClose={() => setPinForm(null)}
          onSaved={(pin) => {
            setPins((prev) => [...prev, pin])
            setPinForm(null)
          }}
        />
      )}
    </div>
  )
}
