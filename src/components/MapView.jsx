import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import { Navigation } from 'lucide-react'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function numberedIcon(num) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:#6366f1;color:white;width:30px;height:30px;
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:12px;font-weight:700;line-height:1;">${num}</span>
      </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -32],
  })
}

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 1) map.setView(positions[0], 14)
    else if (positions.length > 1) map.fitBounds(positions, { padding: [48, 48] })
  }, [map, positions])
  return null
}

/** Buka Google Maps navigation ke koordinat tujuan */
function openGoogleMaps(lat, lng, label) {
  // Pakai format query=lat,lng agar langsung tampil pin + bisa navigate
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Buka semua destinasi sebagai waypoints di Google Maps */
function openAllInGoogleMaps(pinned) {
  if (pinned.length === 0) return
  if (pinned.length === 1) {
    openGoogleMaps(pinned[0].lat, pinned[0].lng, pinned[0].title)
    return
  }
  const origin = `${pinned[0].lat},${pinned[0].lng}`
  const destination = `${pinned[pinned.length - 1].lat},${pinned[pinned.length - 1].lng}`
  const waypoints = pinned
    .slice(1, -1)
    .map(p => `${p.lat},${p.lng}`)
    .join('|')
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export default function MapView({ events }) {
  const pinned = events
    .map((ev, i) => ({ ...ev, order: i + 1 }))
    .filter(ev => ev.lat !== null && ev.lng !== null)

  const positions = pinned.map(ev => [ev.lat, ev.lng])

  if (pinned.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-border p-8 text-center text-text-muted">
        <p className="text-sm">Belum ada destinasi dengan lokasi.</p>
        <p className="text-xs mt-1">Tambah lokasi saat membuat destinasi baru.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* Header peta */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text-heading">Peta Destinasi</h3>
          <p className="text-xs text-text-muted">{pinned.length} lokasi</p>
        </div>
        {/* Tombol buka semua di Google Maps */}
        <button
          onClick={() => openAllInGoogleMaps(pinned)}
          className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors shrink-0"
        >
          <Navigation size={13} />
          Navigasi Semua di Google Maps
        </button>
      </div>

      {/* Peta */}
      <div style={{ height: 380 }}>
        <MapContainer center={positions[0]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds positions={positions} />

          {positions.length > 1 && (
            <Polyline
              positions={positions}
              pathOptions={{ color: '#6366f1', weight: 2.5, opacity: 0.6, dashArray: '6 6' }}
            />
          )}

          {pinned.map((ev) => (
            <Marker key={ev.id} position={[ev.lat, ev.lng]} icon={numberedIcon(ev.order)}>
              <Popup minWidth={180}>
                <div className="text-xs">
                  <div className="font-bold text-sm mb-0.5">{ev.title}</div>
                  <div className="text-gray-500">
                    {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                  </div>
                  {ev.locationName && (
                    <div className="text-gray-400 mt-1 leading-snug">{ev.locationName}</div>
                  )}
                  {/* Tombol direct Google Maps per destinasi */}
                  <button
                    onClick={() => openGoogleMaps(ev.lat, ev.lng, ev.title)}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 bg-primary text-white text-xs font-semibold py-1.5 px-3 rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    <Navigation size={11} />
                    Navigasi ke Sini
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legenda */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex flex-wrap gap-2">
          {pinned.map((ev) => (
            <div
              key={ev.id}
              className="inline-flex items-center gap-1.5 bg-primary-bg text-primary text-xs font-semibold px-3 py-1 rounded-full"
            >
              <span className="bg-primary text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">
                {ev.order}
              </span>
              {ev.title}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
