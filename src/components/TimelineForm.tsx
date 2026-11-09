import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import {
  PlusCircle,
  X,
  Search,
  MapPin,
  Loader2,
  Pencil,
  Clock,
  FileText,
  Wallet,
  AlertCircle,
} from 'lucide-react'
import L from 'leaflet'
import type { EventCategory, NewTimelineEventInput, TimelineEvent } from '../types'
import {
  CATEGORY_MAP,
  getDayDateLabel,
  getEventDurationLabel,
  isTimeRangeInvalid,
} from '../utils/geo'

// Fix icon default Leaflet
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 0.9 })
  }, [map, position])
  return null
}

interface NominatimResult {
  place_id: number
  lat: string
  lon: string
  display_name: string
}

interface TimelineFormProps {
  daysCount: number
  startDate: string
  defaultDayNumber: number
  editingEvent: TimelineEvent | null
  onAddEvent: (ev: NewTimelineEventInput) => void
  onUpdateEvent: (ev: NewTimelineEventInput) => void
  onCancel: () => void
}

export default function TimelineForm({
  daysCount,
  startDate,
  defaultDayNumber,
  editingEvent,
  onAddEvent,
  onUpdateEvent,
  onCancel,
}: TimelineFormProps) {
  const isEdit = Boolean(editingEvent)

  const [dayNumber, setDayNumber] = useState<number>(
    () => editingEvent?.dayNumber || defaultDayNumber || 1
  )
  const [title, setTitle] = useState(() => editingEvent?.title ?? '')
  const [category, setCategory] = useState<EventCategory>(
    () => editingEvent?.category ?? 'wisata'
  )
  const [startTime, setStartTime] = useState(() => editingEvent?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(() => editingEvent?.endTime ?? '10:30')
  const [locationName, setLocationName] = useState(
    () => editingEvent?.locationName ?? ''
  )
  const [lat, setLat] = useState<number | null>(() => editingEvent?.lat ?? null)
  const [lng, setLng] = useState<number | null>(() => editingEvent?.lng ?? null)
  const [notes, setNotes] = useState(() => editingEvent?.notes ?? '')
  const [estimatedCost, setEstimatedCost] = useState<string>(() =>
    editingEvent?.estimatedCost && editingEvent.estimatedCost > 0
      ? String(editingEvent.estimatedCost)
      : ''
  )
  const [showMapPicker, setShowMapPicker] = useState(() =>
    Boolean(editingEvent && editingEvent.lat !== null && editingEvent.lng !== null)
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [mapCenter] = useState<[number, number]>([-6.9147, 107.6098])
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchLocation = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'id' } }
      )
      const data = (await res.json()) as NominatimResult[]
      setSearchResults(Array.isArray(data) ? data : [])
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      void searchLocation(searchQuery)
    }, 450)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [searchQuery, searchLocation])

  const handleSelectResult = (result: NominatimResult) => {
    const newLat = parseFloat(result.lat)
    const newLng = parseFloat(result.lon)
    setLat(newLat)
    setLng(newLng)
    const cleanName = result.display_name.split(',').slice(0, 3).join(',').trim()
    setLocationName(cleanName)
    if (!title.trim()) {
      setTitle(result.display_name.split(',')[0].trim())
    }
    setSearchQuery('')
    setSearchResults([])
    setShowMapPicker(true)
  }

  const handleMapClick = useCallback(async (clickLat: number, clickLng: number) => {
    setLat(clickLat)
    setLng(clickLng)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${clickLat}&lon=${clickLng}&format=json&accept-language=id`
      )
      const data = (await res.json()) as { display_name?: string }
      setLocationName(
        data.display_name?.split(',').slice(0, 3).join(',').trim() ??
          `${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`
      )
    } catch {
      setLocationName(`${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}`)
    }
  }, [])

  const handleClearLocation = () => {
    setLat(null)
    setLng(null)
    setLocationName('')
    setSearchQuery('')
    setSearchResults([])
  }

  const timeInvalid = isTimeRangeInvalid(startTime, endTime)
  const durationLabel = getEventDurationLabel(startTime, endTime)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startTime || timeInvalid) return

    const payload: NewTimelineEventInput = {
      dayNumber,
      title: title.trim(),
      category,
      startTime,
      endTime,
      locationName: locationName.trim(),
      lat,
      lng,
      notes: notes.trim(),
      estimatedCost: Math.max(0, Number(estimatedCost) || 0),
      completed: editingEvent?.completed ?? false,
    }

    if (isEdit) onUpdateEvent(payload)
    else onAddEvent(payload)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-5 shadow-md border border-primary/30 mb-6 animate-fade-in-up"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <h3 className="text-sm font-extrabold text-text-heading flex items-center gap-2">
          {isEdit ? (
            <>
              <Pencil size={15} className="text-primary" />
              Edit Destinasi / Aktivitas
            </>
          ) : (
            <>
              <PlusCircle size={16} className="text-primary" />
              Tambah Destinasi ke Rute
            </>
          )}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-lg text-text-muted hover:text-danger transition-colors"
          aria-label="Tutup form"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3.5">
        {/* Pilihan Hari */}
        <div>
          <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
            Pilih Hari Perjalanan
          </label>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {Array.from({ length: Math.max(1, daysCount) }, (_, idx) => idx + 1).map(
              (d) => {
                const dateSub = getDayDateLabel(startDate, d)
                const active = dayNumber === d
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDayNumber(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                      active
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface-alt text-text-body border-border hover:border-primary/40'
                    }`}
                  >
                    Hari {d}
                    {dateSub && (
                      <span
                        className={`ml-1 font-normal text-[11px] ${
                          active ? 'text-teal-100' : 'text-text-muted'
                        }`}
                      >
                        ({dateSub})
                      </span>
                    )}
                  </button>
                )
              }
            )}
          </div>
        </div>

        {/* Kategori Destinasi (Tanpa tiket hotel / tiket transportasi) */}
        <div>
          <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
            Kategori Aktivitas
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CATEGORY_MAP) as EventCategory[]).map((catKey) => {
              const meta = CATEGORY_MAP[catKey]
              const isSelected = category === catKey
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setCategory(catKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    isSelected
                      ? `${meta.bgClass} ${meta.textClass} ${meta.borderClass} ring-2 ring-primary/20`
                      : 'bg-surface-alt text-text-muted border-border hover:text-text-heading'
                  }`}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Nama Destinasi */}
        <div>
          <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Nama Destinasi / Agenda *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Misal: Eksplorasi Kawah Putih atau Makan Siang di Braga"
            className="w-full px-3.5 py-2.5 bg-surface-alt border border-border rounded-xl text-sm text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            required
          />
        </div>

        {/* Waktu Mulai & Selesai */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
              Waktu Kunjungan
            </label>
            {durationLabel && !timeInvalid && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary-bg px-2 py-0.5 rounded-md">
                <Clock size={11} />
                Durasi: {durationLabel}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] text-text-muted mb-1">Jam Mulai *</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2 bg-surface-alt border border-border rounded-xl text-xs font-semibold text-text-heading focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                required
              />
            </div>
            <div>
              <span className="block text-[11px] text-text-muted mb-1">
                Jam Selesai (opsional)
              </span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`w-full px-3.5 py-2 bg-surface-alt border rounded-xl text-xs font-semibold text-text-heading focus:outline-none focus:ring-2 ${
                  timeInvalid
                    ? 'border-danger focus:ring-danger/30'
                    : 'border-border focus:ring-primary/30 focus:border-primary'
                }`}
              />
            </div>
          </div>
          {timeInvalid && (
            <p className="mt-1.5 text-xs text-danger flex items-center gap-1 font-medium">
              <AlertCircle size={13} />
              Jam selesai tidak boleh lebih awal dari jam mulai.
            </p>
          )}
        </div>

        {/* Pencarian Lokasi & Peta */}
        <div>
          <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Titik Lokasi di Peta <span className="normal-case font-normal">(opsional)</span>
          </label>

          {locationName && (
            <div className="flex items-center gap-2 bg-primary-bg border border-teal-200 rounded-xl px-3 py-2 mb-2">
              <MapPin size={14} className="text-primary shrink-0" />
              <span className="text-xs text-teal-900 font-semibold flex-1 truncate">
                {locationName}
              </span>
              <button
                type="button"
                onClick={handleClearLocation}
                className="text-teal-700/60 hover:text-danger"
                title="Hapus lokasi"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="relative">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            {isSearching && (
              <Loader2
                size={14}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary animate-spin"
              />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama tempat / alamat di OpenStreetMap..."
              className="w-full pl-9 pr-4 py-2 bg-surface-alt border border-border rounded-xl text-xs text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {searchResults.length > 0 && (
            <ul className="mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden z-20 relative">
              {searchResults.map((r) => (
                <li key={r.place_id}>
                  <button
                    type="button"
                    onClick={() => handleSelectResult(r)}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-text-heading hover:bg-primary-bg transition-colors border-b border-border last:border-0"
                  >
                    <span className="font-bold">{r.display_name.split(',')[0]}</span>
                    <span className="text-text-muted ml-1">
                      {r.display_name.split(',').slice(1, 3).join(',')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setShowMapPicker((v) => !v)}
            className="mt-2 text-xs text-primary font-bold hover:underline inline-flex items-center gap-1"
          >
            <MapPin size={13} />
            {showMapPicker
              ? 'Sembunyikan pemilih peta'
              : 'Atau klik langsung titik di atas peta'}
          </button>
        </div>

        {showMapPicker && (
          <div
            className="rounded-xl overflow-hidden border border-border"
            style={{ height: 210 }}
          >
            <MapContainer
              center={lat !== null && lng !== null ? [lat, lng] : mapCenter}
              zoom={lat !== null && lng !== null ? 15 : 11}
              style={{ height: '100%', width: '100%' }}
            >
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

        {/* Catatan & Estimasi Biaya */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              <span className="inline-flex items-center gap-1">
                <FileText size={11} /> Catatan / Tips (opsional)
              </span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cth: Pesan kopi susu & duduk di balkon"
              className="w-full px-3 py-2 bg-surface-alt border border-border rounded-xl text-xs text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              <span className="inline-flex items-center gap-1">
                <Wallet size={11} /> Estimasi Biaya Rp (opsional)
              </span>
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="Cth: 50000"
              className="w-full px-3 py-2 bg-surface-alt border border-border rounded-xl text-xs text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        {/* Tombol Submit */}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-text-body hover:bg-surface-alt transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={timeInvalid}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-xs transition-colors shadow-xs"
          >
            {isEdit ? (
              <>
                <Pencil size={14} /> Simpan Perubahan
              </>
            ) : (
              <>
                <PlusCircle size={15} /> Tambah ke Hari {dayNumber}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
