import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { useEffect, useMemo } from 'react'
import { Navigation, Route, Compass, MapPin } from 'lucide-react'
import L from 'leaflet'
import type { TimelineEvent } from '../types'
import {
  CATEGORY_MAP,
  calculateDistanceKm,
  createCurvedRoutePoints,
  formatCurrencyIDR,
  formatDistance,
  getDayColor,
  sortEventsChronologically,
} from '../utils/geo'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function createStipplPinIcon(num: number, color: string, isFocused: boolean) {
  const size = isFocused ? 36 : 30
  const ring = isFocused ? '0 0 0 5px rgba(13, 148, 136, 0.28),' : ''
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:${color};
        color:white;
        width:${size}px;
        height:${size}px;
        border-radius:50% 50% 50% 4px;
        transform:rotate(-45deg);
        border:3px solid white;
        box-shadow:${ring} 0 4px 10px rgba(15,23,42,0.28);
        display:flex;
        align-items:center;
        justify-content:center;
        transition:all 0.2s ease;">
        <span style="transform:rotate(45deg);font-size:${
          isFocused ? 13 : 11
        }px;font-weight:800;line-height:1;">${num}</span>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -(size + 2)],
  })
}

function MapViewportController({
  positions,
  focusedPoint,
}: {
  positions: [number, number][]
  focusedPoint: [number, number] | null
}) {
  const map = useMap()

  useEffect(() => {
    if (focusedPoint) {
      map.flyTo(focusedPoint, 15, { duration: 0.85 })
      return
    }
    if (positions.length === 1) {
      map.setView(positions[0], 14)
    } else if (positions.length > 1) {
      map.fitBounds(positions, { padding: [54, 54], maxZoom: 15 })
    }
  }, [map, positions, focusedPoint])

  return null
}

function openSingleGoogleMaps(lat: number, lng: number) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function openMultiStopGoogleMaps(pinned: TimelineEvent[]) {
  if (pinned.length === 0) return
  if (pinned.length === 1) {
    openSingleGoogleMaps(pinned[0].lat!, pinned[0].lng!)
    return
  }
  // Google Maps URL mendukung maksimal ~9 waypoints per link
  const capped = pinned.slice(0, 11)
  const origin = `${capped[0].lat},${capped[0].lng}`
  const destination = `${capped[capped.length - 1].lat},${capped[capped.length - 1].lng}`
  const waypoints = capped
    .slice(1, -1)
    .map((p) => `${p.lat},${p.lng}`)
    .join('|')
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
    waypoints ? `&waypoints=${waypoints}` : ''
  }&travelmode=driving`
  window.open(url, '_blank', 'noopener,noreferrer')
}

interface MapViewProps {
  events: TimelineEvent[]
  activeDay: number | 'all'
  focusedEventId: string | null
  stopOrderMap: Map<string, number>
  onSelectEvent: (ev: TimelineEvent) => void
}

export default function MapView({
  events,
  activeDay,
  focusedEventId,
  stopOrderMap,
  onSelectEvent,
}: MapViewProps) {
  const sortedVisible = useMemo(() => {
    const filtered =
      activeDay === 'all'
        ? events
        : events.filter((e) => (e.dayNumber || 1) === activeDay)
    return sortEventsChronologically(filtered)
  }, [events, activeDay])

  const pinned = useMemo(
    () =>
      sortedVisible
        .filter((ev) => ev.lat !== null && ev.lng !== null)
        .map((ev, idx) => ({
          ...ev,
          order: stopOrderMap.get(String(ev.id)) ?? idx + 1,
        })),
    [sortedVisible, stopOrderMap]
  )

  const positions = useMemo<[number, number][]>(
    () => pinned.map((ev) => [ev.lat!, ev.lng!]),
    [pinned]
  )

  const focusedPoint = useMemo<[number, number] | null>(() => {
    if (!focusedEventId) return null
    const found = pinned.find((p) => String(p.id) === String(focusedEventId))
    return found ? [found.lat!, found.lng!] : null
  }, [focusedEventId, pinned])

  // Bangun segmen garis rute lengkung ala Stippl per segmen berurutan
  const routeSegments = useMemo(() => {
    const segs: {
      key: string
      points: [number, number][]
      color: string
      isCrossDay: boolean
    }[] = []
    for (let i = 0; i < pinned.length - 1; i++) {
      const a = pinned[i]
      const b = pinned[i + 1]
      const isCrossDay = a.dayNumber !== b.dayNumber
      const curve = createCurvedRoutePoints([a.lat!, a.lng!], [b.lat!, b.lng!])
      segs.push({
        key: `${a.id}->${b.id}`,
        points: curve,
        color: isCrossDay ? '#64748b' : getDayColor(a.dayNumber || 1),
        isCrossDay,
      })
    }
    return segs
  }, [pinned])

  // Total jarak rute yang sedang ditampilkan
  const totalDistanceKm = useMemo(() => {
    let total = 0
    for (let i = 0; i < pinned.length - 1; i++) {
      total += calculateDistanceKm(
        pinned[i].lat!,
        pinned[i].lng!,
        pinned[i + 1].lat!,
        pinned[i + 1].lng!
      )
    }
    return total
  }, [pinned])

  if (pinned.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-border h-full min-h-[380px] flex flex-col items-center justify-center p-8 text-center text-text-muted">
        <div className="w-14 h-14 rounded-2xl bg-primary-bg text-primary flex items-center justify-center mb-3">
          <Compass size={28} />
        </div>
        <h3 className="font-bold text-text-heading text-sm">
          Belum Ada Titik Koordinat di {activeDay === 'all' ? 'Perjalanan Ini' : `Hari ${activeDay}`}
        </h3>
        <p className="text-xs mt-1 max-w-xs leading-relaxed">
          Cari nama tempat atau klik titik di peta saat menambah destinasi agar alur rute otomatis
          tergambar di sini.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-xs flex flex-col h-full min-h-[440px]">
      {/* Top Map Bar */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary-bg text-primary flex items-center justify-center shrink-0">
            <Route size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-extrabold text-text-heading truncate">
              Peta Rute {activeDay === 'all' ? 'Semua Hari' : `Hari ${activeDay}`}
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              <span>{pinned.length} titik lokasi</span>
              {totalDistanceKm > 0 && (
                <>
                  <span>•</span>
                  <span className="font-bold text-primary">
                    Total ±{formatDistance(totalDistanceKm)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => openMultiStopGoogleMaps(pinned)}
          className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shrink-0 shadow-2xs"
          title="Buka seluruh rute di Google Maps"
        >
          <Navigation size={13} />
          <span className="hidden sm:inline">Buka Rute di</span> Google Maps
        </button>
      </div>

      {/* Interactive Leaflet Map */}
      <div className="flex-1 relative min-h-[340px]">
        <MapContainer
          center={positions[0]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapViewportController
            positions={positions}
            focusedPoint={focusedPoint}
          />

          {/* Garis Rute Lengkung ala Stippl */}
          {routeSegments.map((seg) => (
            <Polyline
              key={seg.key}
              positions={seg.points}
              pathOptions={{
                color: seg.color,
                weight: seg.isCrossDay ? 2.5 : 3.5,
                opacity: seg.isCrossDay ? 0.5 : 0.85,
                dashArray: seg.isCrossDay ? '4 8' : '8 6',
              }}
            />
          ))}

          {/* Pin Destinasi Berurutan */}
          {pinned.map((ev) => {
            const color = getDayColor(ev.dayNumber || 1)
            const isFocused = String(focusedEventId) === String(ev.id)
            const catMeta = CATEGORY_MAP[ev.category] ?? CATEGORY_MAP.wisata

            return (
              <Marker
                key={ev.id}
                position={[ev.lat!, ev.lng!]}
                icon={createStipplPinIcon(ev.order, color, isFocused)}
                eventHandlers={{
                  click: () => onSelectEvent(ev),
                }}
              >
                <Popup minWidth={210}>
                  <div className="text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className="text-[10px] font-extrabold text-white px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: color }}
                      >
                        Hari {ev.dayNumber || 1} • #{ev.order}
                      </span>
                      <span className="text-[11px] font-bold text-slate-600">
                        {ev.startTime}
                        {ev.endTime ? `–${ev.endTime}` : ''}
                      </span>
                    </div>

                    <div className="font-extrabold text-slate-900 text-sm leading-snug">
                      {ev.title}
                    </div>

                    <div className="mt-1 inline-block text-[10px] font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded">
                      {catMeta.label}
                    </div>

                    {ev.locationName && (
                      <div className="text-slate-500 mt-1.5 leading-snug flex items-start gap-1">
                        <MapPin size={11} className="shrink-0 mt-0.5 text-teal-600" />
                        <span>{ev.locationName}</span>
                      </div>
                    )}

                    {ev.estimatedCost > 0 && (
                      <div className="mt-1 text-[11px] font-bold text-amber-700">
                        Estimasi: {formatCurrencyIDR(ev.estimatedCost)}
                      </div>
                    )}

                    <button
                      onClick={() => openSingleGoogleMaps(ev.lat!, ev.lng!)}
                      className="mt-2.5 w-full flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-colors"
                    >
                      <Navigation size={11} />
                      Navigasi ke Titik Ini
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      {/* Bottom Interactive Route Stop Strip (Stippl Stop Carousel) */}
      <div className="px-3 py-2.5 border-t border-border bg-surface-alt overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {pinned.map((ev, i) => {
            const color = getDayColor(ev.dayNumber || 1)
            const isFocused = String(focusedEventId) === String(ev.id)
            return (
              <div key={ev.id} className="inline-flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectEvent(ev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                    isFocused
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-text-heading border-border hover:border-primary'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {ev.order}
                  </span>
                  <span className="max-w-[130px] truncate">{ev.title}</span>
                </button>
                {i < pinned.length - 1 && (
                  <span className="text-text-muted text-xs font-bold">→</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
