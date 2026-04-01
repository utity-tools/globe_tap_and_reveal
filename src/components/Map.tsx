import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMapEvents } from 'react-leaflet'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import type { Pin } from '../types'
import PinForm from './PinForm'
import PinPopup from './PinPopup'

const COUNTRIES_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson'

// ── Country feature shape ─────────────────────────────────
interface CountryProps {
  ADMIN: string
  ISO_A3: string
  ISO_A2: string
}

type CountryFeature = Feature<Geometry, CountryProps>

// ── Styles ────────────────────────────────────────────────
function getCountryStyle(visited: boolean): L.PathOptions {
  return {
    fillColor: visited ? '#7c3aed' : '#1e293b',
    fillOpacity: visited ? 0.6 : 0.3,
    color: visited ? '#a78bfa' : '#2d3f55',
    weight: visited ? 1 : 0.5,
  }
}

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

  // ── Sync visitedRef + update layer styles ──────────────
  useEffect(() => {
    visitedRef.current = visitedSet
    if (!geoJsonRef.current) return
    geoJsonRef.current.eachLayer((layer) => {
      const l = layer as L.Path & { feature?: CountryFeature }
      const code = l.feature?.properties?.ISO_A3
      if (code) l.setStyle(getCountryStyle(visitedSet.has(code)))
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

  // ── Toggle visited country ─────────────────────────────
  const handleCountryClick = useCallback(async (feature: CountryFeature) => {
    const { ISO_A3: code, ADMIN: name } = feature.properties

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

  // ── GeoJSON per-feature setup (stable, uses *Ref) ─────
  const onEachCountry = useCallback((feature: Feature, layer: L.Layer) => {
    const typedFeature = feature as CountryFeature
    const path = layer as L.Path

    path.on({
      mousedown: (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e.originalEvent)
      },
      click: () => handleCountryClick(typedFeature),
      mouseover: () =>
        path.setStyle({
          fillOpacity: visitedRef.current.has(typedFeature.properties.ISO_A3) ? 0.85 : 0.5,
        }),
      mouseout: () =>
        path.setStyle(getCountryStyle(visitedRef.current.has(typedFeature.properties.ISO_A3))),
    })
  }, [handleCountryClick])

  const countryStyle = useCallback(
    (feature?: Feature): L.PathOptions =>
      getCountryStyle(
        visitedRef.current.has((feature as CountryFeature | undefined)?.properties?.ISO_A3 ?? '')
      ),
    []
  )

  // ── Delete pin ─────────────────────────────────────────
  const handleDeletePin = useCallback(async (id: string) => {
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
