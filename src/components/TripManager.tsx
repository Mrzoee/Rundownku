import { useState, useMemo } from 'react'
import {
  Plus,
  MapPinned,
  ChevronRight,
  Trash2,
  Calendar,
  X,
  Search,
  Copy,
  Cloud,
  HardDrive,
  Compass,
  Route,
  CheckCircle2,
  Wallet,
} from 'lucide-react'
import type { TimelineEvent, Trip } from '../types'
import {
  formatCurrencyIDR,
  formatDateRange,
  getDaysCountBetween,
  sortEventsChronologically,
} from '../utils/geo'

interface TripManagerProps {
  trips: Trip[]
  allEvents: TimelineEvent[]
  isCloudConnected: boolean
  onSelect: (trip: Trip) => void
  onCreate: (data: {
    title: string
    description: string
    startDate: string
    endDate: string
    daysCount: number
  }) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onOpenCloudModal: () => void
}

export default function TripManager({
  trips,
  allEvents,
  isCloudConnected,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onOpenCloudModal,
}: TripManagerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // State form buat trip baru
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [manualDays, setManualDays] = useState(3)

  const eventsByTrip = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>()
    for (const ev of allEvents) {
      const key = String(ev.tripId)
      const list = map.get(key) ?? []
      list.push(ev)
      map.set(key, list)
    }
    return map
  }, [allEvents])

  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return trips
    return trips.filter((t) => {
      if (t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) {
        return true
      }
      const evs = eventsByTrip.get(String(t.id)) ?? []
      return evs.some(
        (e) =>
          e.title.toLowerCase().includes(q) || e.locationName.toLowerCase().includes(q)
      )
    })
  }, [trips, searchQuery, eventsByTrip])

  const handleOpenCreate = () => {
    setNewTitle('')
    setNewDesc('')
    setNewStartDate('')
    setNewEndDate('')
    setManualDays(3)
    setShowCreateModal(true)
  }

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const title = newTitle.trim() || 'Petualangan Baru'
    const endDate = newEndDate && newEndDate >= newStartDate ? newEndDate : newStartDate
    const daysCount =
      newStartDate && endDate
        ? getDaysCountBetween(newStartDate, endDate)
        : Math.max(1, Math.min(30, manualDays))

    onCreate({
      title,
      description: newDesc.trim(),
      startDate: newStartDate,
      endDate,
      daysCount,
    })
    setShowCreateModal(false)
  }

  return (
    <div className="min-h-screen bg-surface-alt flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-border sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs">
              <Compass size={22} />
            </div>
            <div>
              <span className="font-extrabold text-lg text-text-heading tracking-tight">
                Rundownku
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-text-muted font-medium">
                Visual Trip & Route Planner
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="btn-cloud-config"
              onClick={onOpenCloudModal}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                isCloudConnected
                  ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100/70'
                  : 'bg-surface-alt text-text-body border-border hover:border-slate-300'
              }`}
              title="Pengaturan Database Hybrid (IndexedDB + Supabase)"
            >
              {isCloudConnected ? (
                <>
                  <Cloud size={14} className="text-primary" />
                  <span>Supabase Aktif</span>
                </>
              ) : (
                <>
                  <HardDrive size={14} className="text-text-muted" />
                  <span>Mode Lokal</span>
                </>
              )}
            </button>

            <button
              id="btn-create-trip-header"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <Plus size={16} />
              <span>Rencana Baru</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero & Filter Section */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-heading tracking-tight">
              Rencana Perjalanan Saya
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Susun itinerary multi-hari dan petakan rute antar destinasi secara visual.
            </p>
          </div>

          {/* Search input */}
          {trips.length > 0 && (
            <div className="relative w-full md:w-72">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                id="input-search-trips"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari perjalanan atau destinasi..."
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-border rounded-xl text-xs text-text-heading placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-heading"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Empty State */}
        {filteredTrips.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-12 text-center max-w-lg mx-auto my-6">
            <div className="w-14 h-14 rounded-2xl bg-primary-bg text-primary flex items-center justify-center mx-auto mb-4">
              <Route size={28} />
            </div>
            <h2 className="text-base font-bold text-text-heading">
              {searchQuery ? 'Perjalanan tidak ditemukan' : 'Belum ada rencana perjalanan'}
            </h2>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
              {searchQuery
                ? 'Coba kata kunci lain atau buat rencana perjalanan baru.'
                : 'Mulai petakan destinasi harian, urutan rute peta, dan estimasi pengeluaran perjalanan Anda.'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenCreate}
                className="mt-5 inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors"
              >
                <Plus size={16} />
                Buat Perjalanan Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTrips.map((trip) => {
              const tripEvents = sortEventsChronologically(
                eventsByTrip.get(String(trip.id)) ?? []
              )
              const pinnedCount = tripEvents.filter(
                (e) => e.lat !== null && e.lng !== null
              ).length
              const completedCount = tripEvents.filter((e) => e.completed).length
              const totalBudget = tripEvents.reduce(
                (sum, e) => sum + (e.estimatedCost || 0),
                0
              )
              const stopNames = tripEvents.map((e) => e.title)

              return (
                <div
                  key={trip.id}
                  onClick={() => onSelect(trip)}
                  className="bg-white rounded-2xl border border-border p-5 flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
                >
                  <div>
                    {/* Top Row: Badges + Actions */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 bg-primary-bg text-primary text-[11px] font-bold px-2.5 py-1 rounded-lg">
                          <Calendar size={12} />
                          {trip.daysCount} Hari
                        </span>
                        <span className="inline-flex items-center gap-1 bg-surface-subtle text-text-body text-[11px] font-semibold px-2.5 py-1 rounded-lg">
                          <MapPinned size={12} className="text-primary" />
                          {tripEvents.length} Destinasi
                          {pinnedCount > 0 ? ` (${pinnedCount} di peta)` : ''}
                        </span>
                      </div>

                      {/* Tombol Aksi: selalu terlihat di mobile, hover di desktop */}
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onDuplicate(trip.id)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-bg transition-colors"
                          title="Duplikat perjalanan"
                          aria-label="Duplikat perjalanan"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => setShowConfirmDelete(trip.id)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-rose-50 transition-colors"
                          title="Hapus perjalanan"
                          aria-label="Hapus perjalanan"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h2 className="text-lg font-extrabold text-text-heading group-hover:text-primary transition-colors line-clamp-1">
                      {trip.title}
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatDateRange(trip.startDate, trip.endDate)}
                    </p>

                    {trip.description && (
                      <p className="text-xs text-text-body mt-2 line-clamp-2 leading-relaxed">
                        {trip.description}
                      </p>
                    )}

                    {/* Stippl-style Stop Trail Preview */}
                    {stopNames.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-border-light flex items-center gap-1.5 flex-wrap">
                        {stopNames.slice(0, 3).map((name, idx) => (
                          <div key={idx} className="inline-flex items-center gap-1.5 text-[11px]">
                            <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[10px] font-bold inline-flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-text-body truncate max-w-[120px]">
                              {name}
                            </span>
                            {idx < Math.min(2, stopNames.length - 1) && (
                              <span className="text-text-muted">→</span>
                            )}
                          </div>
                        ))}
                        {stopNames.length > 3 && (
                          <span className="text-[11px] font-semibold text-primary bg-primary-bg px-2 py-0.5 rounded-full">
                            +{stopNames.length - 3} lagi
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Row */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      {totalBudget > 0 && (
                        <span className="inline-flex items-center gap-1 font-semibold text-text-body">
                          <Wallet size={13} className="text-amber-600" />
                          {formatCurrencyIDR(totalBudget)}
                        </span>
                      )}
                      {tripEvents.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-text-muted">
                          <CheckCircle2
                            size={13}
                            className={
                              completedCount === tripEvents.length
                                ? 'text-emerald-600'
                                : 'text-slate-400'
                            }
                          />
                          {completedCount}/{tripEvents.length} selesai
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center gap-1 font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                      Buka Rute
                      <ChevronRight size={15} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal Buat Perjalanan Baru (Stippl Trip Wizard) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-border overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-alt">
              <h3 className="font-bold text-text-heading text-base">
                Buat Rencana Perjalanan Baru
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-heading"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-heading mb-1">
                  Nama Perjalanan / Rundown *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Contoh: Roadtrip Yogyakarta & Solo"
                  className="w-full px-3.5 py-2.5 bg-surface-alt border border-border rounded-xl text-sm text-text-heading focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-heading mb-1">
                  Catatan Singkat <span className="font-normal text-text-muted">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Contoh: Liburan akhir pekan bareng keluarga"
                  className="w-full px-3.5 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-text-heading focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-heading mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => {
                      setNewStartDate(e.target.value)
                      if (!newEndDate || newEndDate < e.target.value) {
                        setNewEndDate(e.target.value)
                      }
                    }}
                    className="w-full px-3 py-2 bg-surface-alt border border-border rounded-xl text-xs text-text-heading focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-heading mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    min={newStartDate || undefined}
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-alt border border-border rounded-xl text-xs text-text-heading focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              {!newStartDate ? (
                <div>
                  <label className="block text-xs font-bold text-text-heading mb-1">
                    Durasi Perjalanan (Jumlah Hari)
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5, 7].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setManualDays(d)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                          manualDays === d
                            ? 'bg-primary text-white border-primary'
                            : 'bg-surface-alt text-text-body border-border hover:border-primary/40'
                        }`}
                      >
                        {d} Hari
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-primary-bg text-primary text-xs font-semibold flex items-center justify-between">
                  <span>Durasi otomatis dari tanggal:</span>
                  <span className="font-extrabold">
                    {getDaysCountBetween(newStartDate, newEndDate || newStartDate)} Hari
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-text-heading hover:bg-surface-alt transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-colors"
                >
                  Buat & Susun Rute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {showConfirmDelete !== null && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-border animate-fade-in-up">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-text-heading text-base">Hapus Perjalanan?</h3>
              <button
                onClick={() => setShowConfirmDelete(null)}
                className="text-text-muted hover:text-danger"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-text-muted mb-5 leading-relaxed">
              Seluruh jadwal hari dan titik destinasi di perjalanan ini akan ikut terhapus secara
              permanen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-text-heading hover:bg-surface-alt transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDelete(showConfirmDelete)
                  setShowConfirmDelete(null)
                }}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-xs font-bold hover:bg-rose-700 transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
