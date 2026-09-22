import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { PlusCircle, X, Search, MapPin, Loader2, Pencil } from 'lucide-react'
import L from 'leaflet'

// Fix icon default Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

// Fly ke posisi baru saat marker berubah
function FlyTo({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 1 })
  }, [map, position])
  return null
}

export default function TimelineForm({ onAddEvent, onUpdateEvent, onCancel, editingEvent }) {
  const isEdit = !!editingEvent

  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [locationName, setLocationName] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [showMap, setShowMap] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [mapCenter] = useState([-2.5, 118])
  const searchTimeout = useRef(null)

  // Isi form saat mode edit
  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title ?? '')
      setStartTime(editingEvent.startTime ?? '')
      setEndTime(editingEvent.endTime ?? '')
      setLocationName(editingEvent.locationName ?? '')
      setLat(editingEvent.lat ?? null)
      setLng(editingEvent.lng ?? null)
      if (editingEvent.lat && editingEvent.lng) setShowMap(true)
    }
  }, [editingEvent])

  const searchLocation = useCallback(async (query) => {
    if (!query.trim()) { setSearchResults([]); return }
    setIsSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'id' } }
      )
      setSearchResults(await res.json())
    } catch { setSearchResults([]) }
    finally { setIsSearching(false) }
  }, [])

  useEffect(() => {
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchLocation(searchQuery), 500)
    return () => clearTimeout(searchTimeout.current)
  }, [searchQuery, searchLocation])

  const handleSelectResult = (result) => {
    const newLat = parseFloat(result.lat)
    const newLng = parseFloat(result.lon)
    setLat(newLat)
    setLng(newLng)
    setLocationName(result.display_name.split(',').slice(0, 2).join(',').trim())
    setSearchQuery('')
    setSearchResults([])
    setShowMap(true)
  }

  const handleMapClick = useCallback(async (clickLat, clickLng) => {
    setLat(clickLat)
    setLng(clickLng)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${clickLat}&lon=${clickLng}&format=json&accept-language=id`
      )
      const data = await res.json()
      setLocationName(data.display_name?.split(',').slice(0, 2).join(',').trim() ?? `${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`)
    } catch {
      setLocationName(`${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`)
    }
  }, [])

  const handleClearLocation = () => {
    setLat(null); setLng(null); setLocationName(''); setSearchQuery(''); setSearchResults([])
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title || !startTime) return
    const payload = { title, startTime, endTime, locationName, lat, lng }
    if (isEdit) onUpdateEvent(payload)
    else onAddEvent(payload)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-5 shadow-sm border border-border mb-8 animate-fade-in-up"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-text-heading flex items-center gap-2">
          {isEdit ? <><Pencil size={15} /> Edit Destinasi</> : 'Tambah Destinasi'}
        </h2>
        <button type="button" onClick={onCancel} className="text-text-muted hover:text-danger transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-3">
        {/* Nama */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Misal: Sarapan di Braga"
          className="w-full px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-sm text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
          required
        />

        {/* Waktu */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">Mulai</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-sm text-text-heading focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">Selesai</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-sm text-text-heading focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" />
          </div>
        </div>

        {/* Lokasi */}
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">
            Lokasi <span className="normal-case font-normal">(opsional)</span>
          </label>

          {locationName && (
            <div className="flex items-center gap-2 bg-primary-bg border border-primary/20 rounded-xl px-3 py-2 mb-2">
              <MapPin size={14} className="text-primary shrink-0" />
              <span className="text-xs text-primary font-medium flex-1 truncate">{locationName}</span>
              <button type="button" onClick={handleClearLocation} className="text-primary/50 hover:text-danger">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            {isSearching && <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari lokasi..."
              className="w-full pl-9 pr-4 py-2.5 bg-surface-alt border border-border rounded-xl text-sm text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
          </div>

          {searchResults.length > 0 && (
            <ul className="mt-1 bg-white border border-border rounded-xl shadow-md overflow-hidden">
              {searchResults.map((r) => (
                <li key={r.place_id}>
                  <button type="button" onClick={() => handleSelectResult(r)}
                    className="w-full text-left px-4 py-2.5 text-xs text-text-heading hover:bg-primary-bg transition-colors border-b border-border last:border-0">
                    <span className="font-semibold">{r.display_name.split(',')[0]}</span>
                    <span className="text-text-muted ml-1">{r.display_name.split(',').slice(1, 3).join(',')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button type="button" onClick={() => setShowMap(v => !v)}
            className="mt-2 text-xs text-primary font-semibold hover:underline flex items-center gap-1">
            <MapPin size={13} />
            {showMap ? 'Sembunyikan peta' : 'Atau pilih langsung di peta'}
          </button>
        </div>

        {/* Peta interaktif */}
        {showMap && (
          <div className="rounded-xl overflow-hidden border border-border" style={{ height: 240 }}>
            <MapContainer center={lat && lng ? [lat, lng] : mapCenter} zoom={lat && lng ? 15 : 5}
              style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler onMapClick={handleMapClick} />
              {lat !== null && lng !== null && (
                <>
                  <Marker position={[lat, lng]} />
                  <FlyTo position={[lat, lng]} />
                </>
              )}
            </MapContainer>
          </div>
        )}

        <button type="submit"
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white py-3 rounded-xl font-semibold text-sm transition-colors mt-1">
          {isEdit ? <><Pencil size={16} /> Simpan Perubahan</> : <><PlusCircle size={18} /> Tambah ke Rundown</>}
        </button>
      </div>
    </form>
  )
}
