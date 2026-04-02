import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, GeoJSON, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import type { Pin } from '../types'
import PinForm from './PinForm'
import PinPopup from './PinPopup'
import Ledger from './Ledger'
import UserNotch from './UserNotch'

const COUNTRIES_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'

// ── Country feature shape ─────────────────────────────────
interface CountryProps {
  ADMIN: string
  ISO_A3: string
  ISO_A2: string
}

type CountryFeature = Feature<Geometry, CountryProps>

// ── Illustrated flat palette ──────────────────────────────
const PALETTE = [
  '#C7D8A1', // light chartreuse
  '#84C27D', // medium green
  '#6BAE6B', // forest green
  '#4A9E56', // dark tropical green
  '#EDEA8E', // desert yellow
  '#B8D48C', // sage green
  '#A0C97A', // lime green
]

function hashCode(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

// ── Point-in-polygon (ray casting) ───────────────────────
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

function findCountryAtPoint(lat: number, lng: number, data: FeatureCollection): CountryFeature | null {
  for (const feature of data.features) {
    const f = feature as CountryFeature
    const { type, coordinates } = f.geometry as { type: string; coordinates: unknown }
    if (type === 'Polygon') {
      if (pointInRing(lng, lat, (coordinates as number[][][])[0])) return f
    } else if (type === 'MultiPolygon') {
      for (const poly of coordinates as number[][][][]) {
        if (pointInRing(lng, lat, poly[0])) return f
      }
    }
  }
  return null
}

function getCountryStyle(code: string, visited: boolean): L.PathOptions {
  const fill = PALETTE[hashCode(code) % PALETTE.length]
  return {
    fillColor: fill,
    fillOpacity: 1,
    color: visited ? '#D4734A' : '#5C8C55',
    weight: visited ? 2 : 0.7,
  }
}

const pinIcon = L.divIcon({
  html: `<div style="
    width:12px;height:12px;
    background:#E07A3C;
    border:2.5px solid #fff;
    border-radius:50%;
    box-shadow:0 2px 6px rgba(0,0,0,0.25)
  "></div>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

// ── Capture map instance for flyTo ───────────────────────
function MapController({ mapRef }: { mapRef: { current: L.Map | null } }) {
  const map = useMap()
  useEffect(() => { mapRef.current = map }, [map, mapRef])
  return null
}

// ── Long-press / right-click handler ─────────────────────
interface MapInteractionsProps {
  onLongPress: (latlng: L.LatLng) => void
}

function MapInteractions({ onLongPress }: MapInteractionsProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPixel = useRef<{ x: number; y: number } | null>(null)
  const startLatlng = useRef<L.LatLng | null>(null)

  useMapEvents({
    contextmenu(e) {
      e.originalEvent.preventDefault()
      if (timer.current) clearTimeout(timer.current)
      onLongPress(e.latlng)
    },
    mousedown(e) {
      if (e.originalEvent.button !== 0) return
      startPixel.current = { x: e.originalEvent.clientX, y: e.originalEvent.clientY }
      startLatlng.current = e.latlng
      timer.current = setTimeout(() => {
        if (startLatlng.current) onLongPress(startLatlng.current)
      }, 700)
    },
    mouseup() {
      if (timer.current) clearTimeout(timer.current)
      startPixel.current = null
    },
    mousemove(e) {
      if (!startPixel.current) return
      const dx = e.originalEvent.clientX - startPixel.current.x
      const dy = e.originalEvent.clientY - startPixel.current.y
      if (dx * dx + dy * dy > 25) {
        if (timer.current) clearTimeout(timer.current)
      }
    },
    dragstart() {
      if (timer.current) clearTimeout(timer.current)
      startPixel.current = null
    },
  })

  return null
}

// ── Main component ────────────────────────────────────────
export default function Map() {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null)
  const [visitedSet, setVisitedSet] = useState<Set<string>>(new Set())
  const [pins, setPins] = useState<Pin[]>([])
  const [pinForm, setPinForm] = useState<L.LatLng | null>(null)

  const geoJsonRef = useRef<L.GeoJSON | null>(null)
  const visitedRef = useRef<Set<string>>(new Set())
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const [ledgerOpen, setLedgerOpen] = useState(false)

  // ── Sync visitedRef + update layer styles ──────────────
  useEffect(() => {
    visitedRef.current = visitedSet
    if (!geoJsonRef.current) return
    geoJsonRef.current.eachLayer((layer) => {
      const l = layer as L.Path & { feature?: CountryFeature }
      const code = l.feature?.properties?.ISO_A3 ?? ''
      if (code) l.setStyle(getCountryStyle(code, visitedSet.has(code)))
    })
  }, [visitedSet])

  // ── Load GeoJSON ───────────────────────────────────────
  useEffect(() => {
    fetch(COUNTRIES_URL)
      .then((r) => r.json())
      .then((data: FeatureCollection) => setGeoData(data))
  }, [])

  // ── Load initial Supabase data ─────────────────────────
  useEffect(() => {
    supabase
      .from('visited_countries')
      .select('country_code')
      .then(({ data }) => {
        if (data) setVisitedSet(new Set(data.map((r) => r.country_code as string)))
      })

    supabase
      .from('pins')
      .select('*')
      .then(({ data }) => {
        if (data) setPins(data as Pin[])
      })
  }, [])

  // ── Realtime: pins ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('pins-realtime')
      .on<Pin>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pins' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPins((prev) => [...prev, payload.new])
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as Pick<Pin, 'id'>
            setPins((prev) => prev.filter((p) => p.id !== deleted.id))
          } else if (payload.eventType === 'UPDATE') {
            setPins((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ── GeoJSON per-feature setup ──────────────────────────
  const onEachCountry = useCallback((feature: Feature, layer: L.Layer) => {
    const typedFeature = feature as CountryFeature
    const path = layer as L.Path
    const code = typedFeature.properties.ISO_A3

    path.on({
      mouseover: () => path.setStyle({ fillOpacity: 0.7 }),
      mouseout: () => path.setStyle(getCountryStyle(code, visitedRef.current.has(code))),
    })
  }, [])

  const countryStyle = useCallback(
    (feature?: Feature): L.PathOptions => {
      const code = (feature as CountryFeature | undefined)?.properties?.ISO_A3 ?? ''
      return getCountryStyle(code, visitedRef.current.has(code))
    },
    []
  )

  // ── Delete pin + unvisit country if no pins remain ────
  const handleDeletePin = useCallback(async (id: string) => {
    const pin = pins.find((p) => p.id === id)
    await supabase.from('pins').delete().eq('id', id)
    const remaining = pins.filter((p) => p.id !== id)
    setPins(remaining)

    if (pin && geoData) {
      const country = findCountryAtPoint(pin.lat, pin.lng, geoData)
      if (country) {
        const code = country.properties.ISO_A3
        const stillHasPin = remaining.some((p) => {
          const c = findCountryAtPoint(p.lat, p.lng, geoData)
          return c?.properties.ISO_A3 === code
        })
        if (!stillHasPin) {
          await supabase.from('visited_countries').delete().eq('country_code', code)
          setVisitedSet((prev) => {
            const next = new Set(prev)
            next.delete(code)
            return next
          })
        }
      }
    }
  }, [pins, geoData])

  return (
    <div className="relative w-full h-screen p-4" style={{ background: '#5B9FD4' }}>
      {/* Card wrapper with rounded corners + inset shadow */}
      <div
        className="relative w-full h-full rounded-[2rem] overflow-hidden"
        style={{
          boxShadow: 'inset 0 2px 30px rgba(0,0,0,0.10), 0 8px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Noise/paper texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-[500]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            opacity: 0.045,
            mixBlendMode: 'multiply',
          }}
        />

        <MapContainer
          center={[20, 0]}
          zoom={2}
          minZoom={2}
          maxBounds={[[-90, -180], [90, 180]]}
          maxBoundsViscosity={1.0}
          className="w-full h-full"
          zoomControl={true}
          attributionControl={false}
        >
          {geoData && (
            <GeoJSON
              ref={geoJsonRef}
              data={geoData}
              style={countryStyle}
              onEachFeature={onEachCountry}
            />
          )}

          <MapController mapRef={mapRef} />
          <MapInteractions onLongPress={setPinForm} />

          {pins.map((pin) => (
            <Marker
              key={pin.id}
              position={[pin.lat, pin.lng]}
              icon={pinIcon}
              ref={(m) => {
                if (m) markersRef.current[pin.id] = m
                else delete markersRef.current[pin.id]
              }}
            >
              <Popup>
                <PinPopup pin={pin} onDelete={handleDeletePin} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* ── Stats HUD ── */}
        <div className="absolute top-4 left-4 z-[1000] rounded-xl px-3 py-2 select-none"
          style={{ background: 'rgba(240,237,225,0.88)', border: '1px solid #D4CDB8', backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
          <p className="font-mono text-xs leading-relaxed">
            <span style={{ color: '#E07A3C', fontWeight: 600 }}>{visitedSet.size}</span>
            <span style={{ color: '#8C7F6E' }}> países · </span>
            <span style={{ color: '#E07A3C', fontWeight: 600 }}>{pins.length}</span>
            <span style={{ color: '#8C7F6E' }}> pines</span>
          </p>
        </div>

        {/* ── Help hint ── */}
        <div className="absolute bottom-6 z-[1000] text-right select-none"
          style={{ right: 'calc(3rem + 12px)' }}>
          <p className="font-mono text-[10px]" style={{ color: 'rgba(60,90,55,0.55)' }}>click para marcar visitado</p>
          <p className="font-mono text-[10px]" style={{ color: 'rgba(60,90,55,0.55)' }}>mantén para añadir pin</p>
        </div>
      </div>

      {/* ── Ledger FAB ── */}
      <button
        onClick={() => setLedgerOpen(true)}
        className="absolute bottom-8 right-8 z-[2000] w-12 h-12 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
        style={{ background: '#F0EDE1', border: '1px solid #D4CDB8' }}
        title="Diario de viajes"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E07A3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      </button>

      {/* ── Ledger panel ── */}
      {ledgerOpen && (
        <Ledger
          pins={pins}
          onClose={() => setLedgerOpen(false)}
          onFlyTo={(pin) => {
            mapRef.current?.flyTo([pin.lat, pin.lng], 6, { duration: 1.2 })
            mapRef.current?.once('moveend', () => {
              markersRef.current[pin.id]?.openPopup()
            })
          }}
        />
      )}

      <UserNotch unlockedCount={visitedSet.size} />

      {pinForm && (
        <PinForm
          latlng={pinForm}
          onClose={() => setPinForm(null)}
          onSaved={(pin) => {
            setPins((prev) => [...prev, pin])
            setPinForm(null)
            if (geoData) {
              const country = findCountryAtPoint(pin.lat, pin.lng, geoData)
              if (country) {
                const { ISO_A3: code, ADMIN: name } = country.properties
                if (!visitedRef.current.has(code)) {
                  supabase.from('visited_countries').insert({ country_code: code, country_name: name })
                  setVisitedSet((prev) => new Set([...prev, code]))
                }
              }
            }
          }}
        />
      )}
    </div>
  )
}
