import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MapContainer, GeoJSON, Marker, Popup, useMapEvents, useMap, ZoomControl } from 'react-leaflet'
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

// ── Biome color system ────────────────────────────────────
const TUNDRA = new Set([
  'RUS', 'CAN', 'GRL', 'ATA', 'ISL', 'SJM',
])

const BOREAL = new Set([
  'NOR', 'SWE', 'FIN', 'EST', 'LVA', 'LTU', 'BLR', 'UKR',
  'POL', 'DEU', 'FRA', 'GBR', 'IRL', 'DNK', 'NLD', 'BEL', 'LUX',
  'AUT', 'CHE', 'CZE', 'SVK', 'HUN', 'SVN', 'HRV', 'SRB', 'MNE',
  'BIH', 'ALB', 'MKD', 'GRC', 'BGR', 'ROU', 'MDA', 'ITA', 'ESP', 'PRT',
  'AND', 'MCO', 'SMR', 'LIE', 'VAT', 'CYP', 'MLT',
  'JPN', 'KOR', 'PRK', 'GEO', 'ARM', 'AZE',
  'USA', 'NZL',
])

const ARID = new Set([
  'DZA', 'EGY', 'LBY', 'MAR', 'TUN', 'ESH',
  'MRT', 'MLI', 'NER', 'TCD', 'SDN', 'SOM', 'DJI', 'ERI',
  'SAU', 'ARE', 'OMN', 'YEM', 'JOR', 'IRQ', 'SYR', 'KWT', 'QAT', 'BHR', 'ISR', 'LBN', 'PSE',
  'KAZ', 'TKM', 'UZB', 'AFG', 'PAK', 'IRN', 'MNG',
  'NAM', 'BWA', 'AUS',
])

const TROPICAL = new Set([
  'BRA', 'COL', 'VEN', 'ECU', 'GUY', 'SUR', 'GUF',
  'MEX', 'CRI', 'PAN', 'HND', 'NIC', 'GTM', 'BLZ', 'SLV',
  'CUB', 'JAM', 'HTI', 'DOM', 'TTO', 'BRB', 'LCA', 'VCT', 'ATG', 'DMA', 'GRD',
  'GHA', 'CIV', 'LBR', 'SLE', 'GIN', 'GNB', 'SEN', 'GMB', 'TGO', 'BEN', 'NGA',
  'CMR', 'GAB', 'COG', 'GNQ', 'STP', 'COD', 'CAF', 'RWA', 'BDI', 'UGA',
  'MDG', 'COM', 'MUS', 'SYC',
  'IDN', 'MYS', 'PHL', 'THA', 'VNM', 'KHM', 'LAO', 'MMR', 'SGP', 'BRN', 'TLS',
  'LKA', 'BGD', 'IND',
  'PNG', 'SLB', 'VUT', 'FJI', 'WSM', 'TON', 'KIR', 'FSM', 'PLW', 'MHL', 'NRU', 'TUV',
])

type Biome = 'tundra' | 'boreal' | 'arid' | 'tropical' | 'grassland'

const BIOME_FILL: Record<Biome, string> = {
  tundra:   '#E2ECE9',
  boreal:   '#4A7D4E',
  arid:     '#DDC597',
  tropical: '#3B6E40',
  grassland:'#C7D8A1',
}


function getBiome(code: string): Biome {
  if (TUNDRA.has(code))   return 'tundra'
  if (BOREAL.has(code))   return 'boreal'
  if (ARID.has(code))     return 'arid'
  if (TROPICAL.has(code)) return 'tropical'
  return 'grassland'
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
  const biome = getBiome(code)
  return {
    fillColor: BIOME_FILL[biome],
    fillOpacity: 1,
    color:     visited ? '#E55A51' : '#D8CDB2',
    weight:    visited ? 2 : 1,
    opacity:   visited ? 1 : 0.5,
    dashArray: visited ? '6 4' : undefined,
  }
}

const pinIcon = L.icon({
  iconUrl: '/pin.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
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
  const [pins, setPins] = useState<Pin[]>([])
  const [pinForm, setPinForm] = useState<L.LatLng | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  const geoJsonRef = useRef<L.GeoJSON | null>(null)
  const unlockedRef = useRef<Set<string>>(new Set())
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const [ledgerOpen, setLedgerOpen] = useState(false)

  // ── Single source of truth: countries unlocked by pins ──
  const unlockedCountries = useMemo(() => {
    if (!geoData) return new Set<string>()
    const codes = new Set<string>()
    for (const pin of pins) {
      const country = findCountryAtPoint(pin.lat, pin.lng, geoData)
      if (country) codes.add(country.properties.ISO_A3)
    }
    return codes
  }, [pins, geoData])

  // ── Sync ref + restyle whenever unlocked set changes ──
  useEffect(() => {
    unlockedRef.current = unlockedCountries
    if (!geoJsonRef.current) return
    geoJsonRef.current.setStyle((feature) => {
      const code = (feature as CountryFeature | undefined)?.properties?.ISO_A3 ?? ''
      return getCountryStyle(code, unlockedRef.current.has(code))
    })
  }, [unlockedCountries])

  // ── Load GeoJSON ───────────────────────────────────────
  useEffect(() => {
    fetch(COUNTRIES_URL)
      .then((r) => r.json())
      .then((data: FeatureCollection) => setGeoData(data))
  }, [])

  // ── Load initial Supabase data — pins are the only truth ─
  useEffect(() => {
    supabase
      .from('pins')
      .select('*')
      .then(({ data }) => {
        if (data) setPins(data as Pin[])
        setIsLoaded(true)
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

    // pointer cursor when over a country, default over ocean
    path.options.className = (path.options.className ?? '') + ' cursor-pointer'

    path.on({
      mouseover: () => {
        if (!unlockedRef.current.has(code))
          path.setStyle({ color: '#E55A51', weight: 1.5, opacity: 0.85 })
      },
      mouseout: () => {
        // resetStyle re-runs countryStyle(feature) from GeoJSON options — fully declarative
        geoJsonRef.current?.resetStyle(path)
      },
    })
  }, [])

  const countryStyle = useCallback(
    (feature?: Feature): L.PathOptions => {
      const code = (feature as CountryFeature | undefined)?.properties?.ISO_A3 ?? ''
      return getCountryStyle(code, unlockedRef.current.has(code))
    },
    []
  )

  // ── Delete pin — useMemo recalculates unlocked countries automatically ──
  const handleDeletePin = useCallback(async (id: string) => {
    await supabase.from('pins').delete().eq('id', id)
    setPins((prev) => prev.filter((p) => p.id !== id))
  }, [])

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
          zoomControl={false}
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

          <ZoomControl position="bottomleft" />
          <MapController mapRef={mapRef} />
          <MapInteractions onLongPress={(latlng) => {
            if (!geoData) return
            if (findCountryAtPoint(latlng.lat, latlng.lng, geoData) === null) return
            setPinForm(latlng)
          }} />

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

        {/* ── Help hint ── */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] text-center select-none pointer-events-none">
          <p className="font-mono text-[10px]" style={{ color: 'rgba(60,90,55,0.45)' }}>
            mantén pulsado el mapa para añadir un pin
          </p>
        </div>
      </div>

      {/* ── Ledger FAB ── */}
      <button
        onClick={() => setLedgerOpen(true)}
        className="absolute bottom-6 right-6 z-[2000] bg-transparent border-0 p-0 cursor-pointer -rotate-12 hover:rotate-0 hover:scale-110 transition-all duration-300 ease-out drop-shadow-xl"
        title="Diario de viajes"
      >
        <img src="/ledger.png" alt="Ledger" className="w-24 h-auto object-contain" />
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

      <UserNotch unlockedCount={unlockedCountries.size} pinsCount={pins.length} isLoaded={isLoaded} />

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
