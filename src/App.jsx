import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import TimelineForm from './components/TimelineForm'
import TimelineView from './components/TimelineView'
import MapView from './components/MapView'
import TripManager from './components/TripManager'
import { db, getAllTrips, createTrip, migrateFromLocalStorage } from './db'
import { Calendar, MapPinned, Sparkles, Map, ArrowLeft, Pencil, Check, X } from 'lucide-react'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function App() {
  // null = halaman TripManager, object = rundown yang sedang dibuka
  const [activeTrip, setActiveTrip] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null) // event yang sedang diedit
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [isReady, setIsReady] = useState(false)

  // Live query daftar semua trips
  const trips = useLiveQuery(() => getAllTrips(), [], [])

  // Inisialisasi: migrasi localStorage lama jika perlu
  useEffect(() => {
    migrateFromLocalStorage().then(() => setIsReady(true))
  }, [])

  // Sync activeTrip jika data di DB berubah (misal title/date diedit)
  const currentTrip = useLiveQuery(
    () => activeTrip ? db.trips.get(activeTrip.id) : null,
    [activeTrip?.id],
    null
  )

  // Events untuk trip yang aktif, urut by startTime
  const events = useLiveQuery(
    () => activeTrip ? db.events.where('tripId').equals(activeTrip.id).sortBy('startTime') : [],
    [activeTrip?.id],
    []
  )

  // ── Trip actions ─────────────────────────────────────────────────────────

  const handleCreateTrip = useCallback(async () => {
    const trip = await createTrip('Buat Rundown')
    setActiveTrip(trip)
    setIsEditingTitle(true)
    setTitleDraft('Buat Rundown')
  }, [])

  const handleSelectTrip = useCallback((trip) => {
    setActiveTrip(trip)
    setIsFormOpen(false)
    setShowMap(false)
    setEditingEvent(null)
  }, [])

  const handleDeleteTrip = useCallback(async (id) => {
    await db.events.where('tripId').equals(id).delete()
    await db.trips.delete(id)
    if (activeTrip?.id === id) setActiveTrip(null)
  }, [activeTrip])

  const handleBack = useCallback(() => {
    setActiveTrip(null)
    setIsFormOpen(false)
    setShowMap(false)
    setEditingEvent(null)
  }, [])

  // ── Title edit ───────────────────────────────────────────────────────────

  const handleStartEditTitle = () => {
    setTitleDraft(currentTrip?.title ?? '')
    setIsEditingTitle(true)
  }

  const handleSaveTitle = useCallback(async () => {
    if (!activeTrip || !titleDraft.trim()) return
    await db.trips.update(activeTrip.id, { title: titleDraft.trim() })
    setIsEditingTitle(false)
  }, [activeTrip, titleDraft])

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false)
    setTitleDraft('')
  }

  // ── Date edit ────────────────────────────────────────────────────────────

  const handleDateChange = useCallback(async (e) => {
    if (!activeTrip) return
    await db.trips.update(activeTrip.id, { date: e.target.value })
  }, [activeTrip])

  // ── Event actions ────────────────────────────────────────────────────────

  const handleAddEvent = useCallback(async (newEvent) => {
    if (!activeTrip) return
    await db.events.add({
      tripId: activeTrip.id,
      title: newEvent.title,
      startTime: newEvent.startTime,
      endTime: newEvent.endTime ?? '',
      locationName: newEvent.locationName ?? '',
      lat: newEvent.lat ?? null,
      lng: newEvent.lng ?? null,
    })
    setIsFormOpen(false)
  }, [activeTrip])

  const handleEditEvent = useCallback((event) => {
    setEditingEvent(event)
    setIsFormOpen(true)
  }, [])

  const handleUpdateEvent = useCallback(async (updated) => {
    if (!editingEvent) return
    await db.events.update(editingEvent.id, {
      title: updated.title,
      startTime: updated.startTime,
      endTime: updated.endTime ?? '',
      locationName: updated.locationName ?? '',
      lat: updated.lat ?? null,
      lng: updated.lng ?? null,
    })
    setEditingEvent(null)
    setIsFormOpen(false)
  }, [editingEvent])

  const handleDeleteEvent = useCallback(async (id) => {
    await db.events.delete(id)
  }, [])

  const handleCancelForm = useCallback(() => {
    setIsFormOpen(false)
    setEditingEvent(null)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────

  if (!isReady) {
    return (
      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
        <div className="text-text-muted text-sm">Memuat data...</div>
      </div>
    )
  }

  // Halaman daftar rundown
  if (!activeTrip) {
    return (
      <TripManager
        trips={trips ?? []}
        onSelect={handleSelectTrip}
        onCreate={handleCreateTrip}
        onDelete={handleDeleteTrip}
      />
    )
  }

  const trip = currentTrip ?? activeTrip

  // Halaman detail rundown
  return (
    <div className="min-h-screen bg-surface-alt pb-24">
      {/* ── Header ── */}
      <header className="bg-white border-b border-border px-6 pt-10 pb-8">
        <div className="max-w-xl mx-auto">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors mb-5"
          >
            <ArrowLeft size={14} />
            Semua Rundown
          </button>

          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 bg-primary-bg text-primary text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
              <Sparkles size={14} />
              Itinerary Planner
            </div>

            {/* Title: tampilkan input atau text */}
            {isEditingTitle ? (
              <div className="flex items-center gap-2 justify-center">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle()
                    if (e.key === 'Escape') handleCancelEditTitle()
                  }}
                  autoFocus
                  className="bg-surface-alt border border-primary rounded-xl px-4 py-2 text-2xl font-bold text-text-heading text-center focus:outline-none focus:ring-2 focus:ring-primary/40 w-full max-w-sm"
                />
                <button onClick={handleSaveTitle} className="p-2 rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors shrink-0">
                  <Check size={16} />
                </button>
                <button onClick={handleCancelEditTitle} className="p-2 rounded-xl border border-border text-text-muted hover:text-danger transition-colors shrink-0">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-3xl font-bold text-text-heading">{trip.title}</h1>
                <button
                  onClick={handleStartEditTitle}
                  className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-bg transition-colors"
                  aria-label="Edit judul"
                >
                  <Pencil size={15} />
                </button>
              </div>
            )}

            {/* Date picker */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <label className="inline-flex items-center gap-2 bg-surface-alt border border-border hover:border-primary px-4 py-2 rounded-xl cursor-pointer transition-colors group">
                <Calendar size={16} className="text-primary shrink-0" />
                <input
                  type="date"
                  value={trip.date ?? ''}
                  onChange={handleDateChange}
                  className="bg-transparent text-sm font-medium text-text-heading focus:outline-none cursor-pointer"
                /></label>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-2xl mx-auto px-4 mt-8">
        {/* Tombol aksi */}
        <div className="flex gap-3 mb-8">
          {!isFormOpen && (
            <button
              onClick={() => { setEditingEvent(null); setIsFormOpen(true) }}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white py-3.5 rounded-2xl font-semibold text-sm transition-colors shadow-md"
            >
              <MapPinned size={18} />
              Tambah Destinasi Baru
            </button>
          )}
          {events && events.length > 0 && !isFormOpen && (
            <button
              onClick={() => setShowMap(v => !v)}
              className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-colors shadow-md border ${
                showMap
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-primary border-border hover:border-primary'
              }`}
            >
              <Map size={18} />
              {showMap ? 'Sembunyikan Peta' : 'Lihat Peta'}
            </button>
          )}
        </div>

        {/* Form tambah / edit destinasi */}
        {isFormOpen && (
          <TimelineForm
            onAddEvent={handleAddEvent}
            onUpdateEvent={handleUpdateEvent}
            onCancel={handleCancelForm}
            editingEvent={editingEvent}
          />
        )}

        {/* Peta keseluruhan */}
        {showMap && events && events.length > 0 && (
          <div className="mb-8">
            <MapView events={events} />
          </div>
        )}

        {/* Timeline */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-text-heading flex items-center gap-2">
              Rundown Acara
              {events && events.length > 0 && (
                <span className="bg-primary-bg text-primary text-xs py-0.5 px-2.5 rounded-full font-bold">
                  {events.length}
                </span>
              )}
            </h2>
          </div>
          <TimelineView
            events={events ?? []}
            onDelete={handleDeleteEvent}
            onEdit={handleEditEvent}
          />
        </div>
      </main>
    </div>
  )
}
