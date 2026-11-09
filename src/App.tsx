import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import TimelineForm from './components/TimelineForm'
import TimelineView from './components/TimelineView'
import MapView from './components/MapView'
import TripManager from './components/TripManager'
import SupabaseModal from './components/SupabaseModal'
import {
  db,
  getAllTrips,
  getTripById,
  getEventsByTripId,
  createTrip,
  updateTrip,
  deleteTrip,
  duplicateTrip,
  addEvent,
  updateEvent,
  deleteEvent,
  initializeDatabase,
  syncWithSupabase,
} from './db'
import { isSupabaseConfigured } from './lib/supabase'
import type { NewTimelineEventInput, TimelineEvent, Trip } from './types'
import {
  calculateDistanceKm,
  decodeShareableTrip,
  encodeShareableTrip,
  formatCurrencyIDR,
  formatDistance,
  formatTripForWhatsApp,
  getDayColor,
  getDayDateLabel,
  getDaysCountBetween,
  sortEventsChronologically,
} from './utils/geo'
import {
  Calendar,
  MapPinned,
  Map as MapIcon,
  ArrowLeft,
  Pencil,
  Check,
  X,
  Share2,
  MessageSquareShare,
  Plus,
  Minus,
  Route,
  Wallet,
  Cloud,
  HardDrive,
  Undo2,
  ListChecks,
  Printer,
} from 'lucide-react'

export default function App() {
  const [activeTripId, setActiveTripId] = useState<string | null>(null)
  const [activeDay, setActiveDay] = useState<number | 'all'>('all')
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'itinerary' | 'map'>('itinerary')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formDefaultDay, setFormDefaultDay] = useState(1)
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null)

  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')

  const [showCloudModal, setShowCloudModal] = useState(false)
  const [cloudConnected, setCloudConnected] = useState(() => isSupabaseConfigured())
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [deletedEventBackup, setDeletedEventBackup] = useState<TimelineEvent | null>(null)
  const [isReady, setIsReady] = useState(false)

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev))
    }, 3500)
  }, [])

  // Live query daftar semua trips dan semua events
  const trips = useLiveQuery(() => getAllTrips(), [], [] as Trip[])
  const allEvents = useLiveQuery(
    async () => {
      const raw = await db.events.toArray()
      return raw.map((e) => ({
        ...e,
        id: String(e.id),
        tripId: String(e.tripId),
        dayNumber: Number(e.dayNumber) || 1,
      }))
    },
    [],
    [] as TimelineEvent[]
  )

  const currentTrip = useLiveQuery(
    () => (activeTripId ? getTripById(activeTripId) : Promise.resolve(null)),
    [activeTripId],
    null
  )

  const events = useLiveQuery(
    () => (activeTripId ? getEventsByTripId(activeTripId) : Promise.resolve([])),
    [activeTripId],
    [] as TimelineEvent[]
  )

  // Inisialisasi DB, cek shared link (?share=...), & sinkronisasi awal Supabase jika ada
  useEffect(() => {
    async function boot() {
      await initializeDatabase()

      // Cek apakah ada parameter ?share= di URL
      const params = new URLSearchParams(window.location.search)
      const sharedEncoded = params.get('share')
      if (sharedEncoded) {
        const decoded = decodeShareableTrip(sharedEncoded)
        if (decoded) {
          const imported = await createTrip(decoded.trip.title, {
            description: decoded.trip.description,
            startDate: decoded.trip.startDate,
            endDate: decoded.trip.endDate,
            daysCount: decoded.trip.daysCount,
          })
          for (const ev of decoded.events) {
            await addEvent(imported.id, {
              ...ev,
              completed: false,
            })
          }
          window.history.replaceState({}, '', window.location.pathname)
          setActiveTripId(imported.id)
          showToast(`Rundown "${imported.title}" berhasil diimpor!`)
        }
      }

      if (isSupabaseConfigured()) {
        setCloudConnected(true)
        void syncWithSupabase()
      }

      setIsReady(true)
    }
    void boot()
  }, [showToast])

  // Buat peta urutan nomor pin (1, 2, 3...) yang konsisten antara TimelineView dan MapView
  const stopOrderMap = useMemo(() => {
    const map = new Map<string, number>()
    const sorted = sortEventsChronologically(events ?? [])
    const filtered =
      activeDay === 'all'
        ? sorted
        : sorted.filter((ev) => (ev.dayNumber || 1) === activeDay)
    let counter = 1
    for (const ev of filtered) {
      if (ev.lat !== null && ev.lng !== null) {
        map.set(String(ev.id), counter++)
      }
    }
    return map
  }, [events, activeDay])

  // Statistik keseluruhan perjalanan aktif
  const tripStats = useMemo(() => {
    const sorted = sortEventsChronologically(events ?? [])
    const pinned = sorted.filter((e) => e.lat !== null && e.lng !== null)
    let totalKm = 0
    for (let i = 0; i < pinned.length - 1; i++) {
      totalKm += calculateDistanceKm(
        pinned[i].lat!,
        pinned[i].lng!,
        pinned[i + 1].lat!,
        pinned[i + 1].lng!
      )
    }
    const totalCost = sorted.reduce((sum, e) => sum + (e.estimatedCost || 0), 0)
    const completedCount = sorted.filter((e) => e.completed).length
    return {
      totalEvents: sorted.length,
      pinnedCount: pinned.length,
      totalKm,
      totalCost,
      completedCount,
    }
  }, [events])

  // ── Trip Actions ───────────────────────────────────────────────────────────

  const handleCreateTrip = useCallback(
    async (data: {
      title: string
      description: string
      startDate: string
      endDate: string
      daysCount: number
    }) => {
      const trip = await createTrip(data.title, {
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        daysCount: data.daysCount,
      })
      setActiveTripId(trip.id)
      setActiveDay('all')
      setIsFormOpen(false)
      setEditingEvent(null)
    },
    []
  )

  const handleSelectTrip = useCallback((trip: Trip) => {
    setActiveTripId(trip.id)
    setActiveDay('all')
    setFocusedEventId(null)
    setIsFormOpen(false)
    setEditingEvent(null)
    setMobileTab('itinerary')
  }, [])

  const handleDuplicateTrip = useCallback(
    async (id: string) => {
      const copy = await duplicateTrip(id)
      if (copy) {
        showToast(`"${copy.title}" berhasil diduplikasi!`)
      }
    },
    [showToast]
  )

  const handleDeleteTrip = useCallback(
    async (id: string) => {
      await deleteTrip(id)
      if (String(activeTripId) === String(id)) {
        setActiveTripId(null)
      }
      showToast('Perjalanan telah dihapus.')
    },
    [activeTripId, showToast]
  )

  const handleBack = useCallback(() => {
    setActiveTripId(null)
    setIsFormOpen(false)
    setEditingEvent(null)
    setFocusedEventId(null)
  }, [])

  // ── Header & Date Range Edit ───────────────────────────────────────────────

  const handleStartEditHeader = () => {
    if (!currentTrip) return
    setTitleDraft(currentTrip.title)
    setDescDraft(currentTrip.description ?? '')
    setIsEditingHeader(true)
  }

  const handleSaveHeader = useCallback(async () => {
    if (!currentTrip || !titleDraft.trim()) return
    await updateTrip(currentTrip.id, {
      title: titleDraft.trim(),
      description: descDraft.trim(),
    })
    setIsEditingHeader(false)
  }, [currentTrip, titleDraft, descDraft])

  const handleStartDateChange = useCallback(
    async (newStart: string) => {
      if (!currentTrip) return
      const newEnd =
        currentTrip.endDate && currentTrip.endDate >= newStart
          ? currentTrip.endDate
          : newStart
      const newDays = newStart
        ? getDaysCountBetween(newStart, newEnd)
        : currentTrip.daysCount
      await updateTrip(currentTrip.id, {
        startDate: newStart,
        endDate: newEnd,
        daysCount: Math.max(currentTrip.daysCount, newDays),
      })
    },
    [currentTrip]
  )

  const handleEndDateChange = useCallback(
    async (newEnd: string) => {
      if (!currentTrip) return
      const start = currentTrip.startDate || newEnd
      const newDays = getDaysCountBetween(start, newEnd)
      await updateTrip(currentTrip.id, {
        startDate: start,
        endDate: newEnd,
        daysCount: newDays,
      })
    },
    [currentTrip]
  )

  const handleChangeDaysCount = useCallback(
    async (delta: number) => {
      if (!currentTrip) return
      const nextDays = Math.max(1, Math.min(30, (currentTrip.daysCount || 1) + delta))
      await updateTrip(currentTrip.id, { daysCount: nextDays })
      if (typeof activeDay === 'number' && activeDay > nextDays) {
        setActiveDay(nextDays)
      }
    },
    [currentTrip, activeDay]
  )

  // ── Event Actions ──────────────────────────────────────────────────────────

  const handleAddEvent = useCallback(
    async (newEvent: NewTimelineEventInput) => {
      if (!currentTrip) return
      const created = await addEvent(currentTrip.id, newEvent)
      setIsFormOpen(false)
      setFocusedEventId(created.id)
      showToast(`Destinasi ditambahkan ke Hari ${newEvent.dayNumber}`)
    },
    [currentTrip, showToast]
  )

  const handleEditEvent = useCallback((event: TimelineEvent) => {
    setEditingEvent(event)
    setFormDefaultDay(event.dayNumber || 1)
    setIsFormOpen(true)
    setMobileTab('itinerary')
  }, [])

  const handleUpdateEvent = useCallback(
    async (updated: NewTimelineEventInput) => {
      if (!editingEvent) return
      await updateEvent(editingEvent.id, updated)
      setFocusedEventId(editingEvent.id)
      setEditingEvent(null)
      setIsFormOpen(false)
      showToast('Perubahan destinasi disimpan.')
    },
    [editingEvent, showToast]
  )

  const handleDeleteEvent = useCallback(
    async (id: string) => {
      const target = (events ?? []).find((e) => String(e.id) === String(id))
      if (target) {
        setDeletedEventBackup(target)
      }
      await deleteEvent(id)
      if (String(focusedEventId) === String(id)) {
        setFocusedEventId(null)
      }
    },
    [events, focusedEventId]
  )

  const handleUndoDeleteEvent = useCallback(async () => {
    if (!deletedEventBackup || !currentTrip) return
    await addEvent(currentTrip.id, {
      dayNumber: deletedEventBackup.dayNumber,
      title: deletedEventBackup.title,
      startTime: deletedEventBackup.startTime,
      endTime: deletedEventBackup.endTime,
      category: deletedEventBackup.category,
      locationName: deletedEventBackup.locationName,
      lat: deletedEventBackup.lat,
      lng: deletedEventBackup.lng,
      notes: deletedEventBackup.notes,
      estimatedCost: deletedEventBackup.estimatedCost,
      completed: deletedEventBackup.completed,
    })
    setDeletedEventBackup(null)
    showToast('Destinasi berhasil dikembalikan!')
  }, [deletedEventBackup, currentTrip, showToast])

  const handleToggleComplete = useCallback(async (event: TimelineEvent) => {
    await updateEvent(event.id, { completed: !event.completed })
  }, [])

  const handleFocusEvent = useCallback((event: TimelineEvent) => {
    setFocusedEventId(String(event.id))
  }, [])

  const handleQuickAddForDay = useCallback((dayNum: number) => {
    setEditingEvent(null)
    setFormDefaultDay(dayNum)
    setIsFormOpen(true)
  }, [])

  // ── Share & Export Actions ─────────────────────────────────────────────────

  const handleCopyWhatsApp = useCallback(async () => {
    if (!currentTrip) return
    const text = formatTripForWhatsApp(currentTrip, events ?? [])
    try {
      await navigator.clipboard.writeText(text)
      showToast('Format teks WhatsApp berhasil disalin ke clipboard!')
    } catch {
      showToast('Gagal menyalin ke clipboard.')
    }
  }, [currentTrip, events, showToast])

  const handleShareLink = useCallback(async () => {
    if (!currentTrip) return
    const encoded = encodeShareableTrip(currentTrip, events ?? [])
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encoded}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      showToast('Tautan berbagi (Share Link) berhasil disalin!')
    } catch {
      showToast('Gagal menyalin tautan berbagi.')
    }
  }, [currentTrip, events, showToast])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isReady) {
    return (
      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
        <div className="text-text-muted text-sm font-medium">
          Memuat ruang kerja perjalanan...
        </div>
      </div>
    )
  }

  // Halaman Daftar Perjalanan (Trip Hub)
  if (!activeTripId || !currentTrip) {
    return (
      <>
        <TripManager
          trips={trips ?? []}
          allEvents={allEvents ?? []}
          isCloudConnected={cloudConnected}
          onSelect={handleSelectTrip}
          onCreate={handleCreateTrip}
          onDuplicate={handleDuplicateTrip}
          onDelete={handleDeleteTrip}
          onOpenCloudModal={() => setShowCloudModal(true)}
        />
        {showCloudModal && (
          <SupabaseModal
            onClose={() => setShowCloudModal(false)}
            onSyncSuccess={() => setCloudConnected(isSupabaseConfigured())}
          />
        )}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg animate-fade-in-up">
            {toastMessage}
          </div>
        )}
      </>
    )
  }

  const daysCount = Math.max(1, currentTrip.daysCount || 1)

  // Halaman Workspace Split-Screen ala Stippl
  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-surface-alt flex flex-col">
      {/* ── Top Workspace Bar ── */}
      <header className="bg-white border-b border-border h-14 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-20 no-print">
        <div className="flex items-center gap-3 min-w-0">
          <button
            id="btn-back-to-trips"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-text-body hover:text-primary bg-surface-alt hover:bg-primary-bg px-3 py-1.5 rounded-xl border border-border transition-colors shrink-0"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Semua Rencana</span>
          </button>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <h1 className="font-extrabold text-sm sm:text-base text-text-heading truncate">
            {currentTrip.title}
          </h1>
        </div>

        {/* Share & Cloud Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyWhatsApp}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100/70 transition-colors"
            title="Salin format teks rapi untuk grup WhatsApp"
          >
            <MessageSquareShare size={13} />
            <span className="hidden md:inline">Salin ke WhatsApp</span>
          </button>

          <button
            onClick={handleShareLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-alt text-text-heading border border-border hover:border-primary transition-colors"
            title="Salin tautan berbagi untuk dibuka teman"
          >
            <Share2 size={13} className="text-primary" />
            <span className="hidden md:inline">Bagikan Link</span>
          </button>

          <button
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-1.5 p-2 rounded-xl text-xs font-bold bg-surface-alt text-text-muted hover:text-text-heading border border-border transition-colors"
            title="Cetak / Simpan PDF"
          >
            <Printer size={14} />
          </button>

          <button
            onClick={() => setShowCloudModal(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              cloudConnected
                ? 'bg-teal-50 text-teal-800 border-teal-200'
                : 'bg-surface-alt text-text-muted border-border'
            }`}
            title="Pengaturan Database Hybrid Supabase"
          >
            {cloudConnected ? (
              <Cloud size={14} className="text-primary" />
            ) : (
              <HardDrive size={14} />
            )}
          </button>
        </div>
      </header>

      {/* ── Split-Screen Body (Left: Itinerary Planner, Right: Interactive Route Map) ── */}
      <div className="flex-1 lg:grid lg:grid-cols-12 lg:overflow-hidden">
        {/* LEFT PANEL: Itinerary & Multi-Day Controls */}
        <div
          className={`lg:col-span-6 xl:col-span-5 lg:h-full lg:overflow-y-auto border-r border-border bg-surface-alt ${
            mobileTab === 'map' ? 'hidden lg:block' : 'block'
          }`}
        >
          {/* Trip Summary Header Card */}
          <div className="bg-white border-b border-border px-5 py-5">
            {isEditingHeader ? (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="Judul perjalanan"
                  autoFocus
                  className="w-full px-3.5 py-2 bg-surface-alt border border-primary rounded-xl text-base font-extrabold text-text-heading focus:outline-none"
                />
                <input
                  type="text"
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  placeholder="Catatan singkat perjalanan (opsional)"
                  className="w-full px-3.5 py-2 bg-surface-alt border border-border rounded-xl text-xs text-text-body focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveHeader}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold"
                  >
                    <Check size={14} /> Simpan
                  </button>
                  <button
                    onClick={() => setIsEditingHeader(false)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-text-muted"
                  >
                    <X size={14} /> Batal
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-extrabold text-text-heading tracking-tight">
                    {currentTrip.title}
                  </h2>
                  {currentTrip.description ? (
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">
                      {currentTrip.description}
                    </p>
                  ) : (
                    <button
                      onClick={handleStartEditHeader}
                      className="text-xs text-text-muted hover:text-primary mt-0.5 inline-block"
                    >
                      + Tambah deskripsi singkat perjalanan
                    </button>
                  )}
                </div>
                <button
                  onClick={handleStartEditHeader}
                  className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-bg transition-colors shrink-0"
                  title="Edit judul & deskripsi"
                >
                  <Pencil size={15} />
                </button>
              </div>
            )}

            {/* Date Pickers & Days Control */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 bg-surface-alt border border-border hover:border-primary/50 px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors">
                <Calendar size={13} className="text-primary shrink-0" />
                <span className="text-[11px] text-text-muted font-semibold">Mulai:</span>
                <input
                  type="date"
                  value={currentTrip.startDate ?? ''}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="bg-transparent text-xs font-bold text-text-heading focus:outline-none cursor-pointer"
                />
              </label>

              <label className="inline-flex items-center gap-1.5 bg-surface-alt border border-border hover:border-primary/50 px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors">
                <span className="text-[11px] text-text-muted font-semibold">Selesai:</span>
                <input
                  type="date"
                  min={currentTrip.startDate || undefined}
                  value={currentTrip.endDate ?? ''}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="bg-transparent text-xs font-bold text-text-heading focus:outline-none cursor-pointer"
                />
              </label>

              <div className="inline-flex items-center gap-1 bg-surface-alt border border-border rounded-xl px-2 py-1">
                <button
                  type="button"
                  onClick={() => handleChangeDaysCount(-1)}
                  disabled={daysCount <= 1}
                  className="p-1 rounded-lg text-text-muted hover:text-text-heading disabled:opacity-30"
                  title="Kurangi jumlah hari"
                >
                  <Minus size={12} />
                </button>
                <span className="text-xs font-extrabold text-text-heading px-1.5">
                  {daysCount} Hari
                </span>
                <button
                  type="button"
                  onClick={() => handleChangeDaysCount(1)}
                  className="p-1 rounded-lg text-text-muted hover:text-primary"
                  title="Tambah hari perjalanan"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Key Metrics Strip */}
            <div className="mt-4 pt-3.5 border-t border-border grid grid-cols-3 gap-2">
              <div className="bg-surface-alt rounded-xl p-2.5 border border-border-light">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <ListChecks size={11} className="text-primary" />
                  Destinasi
                </div>
                <div className="text-sm font-extrabold text-text-heading mt-0.5">
                  {tripStats.totalEvents} Lokasi
                </div>
                <div className="text-[10px] text-text-muted">
                  {tripStats.completedCount}/{tripStats.totalEvents} dikunjungi
                </div>
              </div>

              <div className="bg-surface-alt rounded-xl p-2.5 border border-border-light">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <Route size={11} className="text-primary" />
                  Total Rute
                </div>
                <div className="text-sm font-extrabold text-text-heading mt-0.5">
                  {tripStats.totalKm > 0
                    ? `±${formatDistance(tripStats.totalKm)}`
                    : '0 km'}
                </div>
                <div className="text-[10px] text-text-muted">
                  {tripStats.pinnedCount} titik di peta
                </div>
              </div>

              <div className="bg-surface-alt rounded-xl p-2.5 border border-border-light">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <Wallet size={11} className="text-amber-600" />
                  Estimasi Biaya
                </div>
                <div className="text-sm font-extrabold text-text-heading mt-0.5 truncate">
                  {tripStats.totalCost > 0
                    ? formatCurrencyIDR(tripStats.totalCost)
                    : 'Rp 0'}
                </div>
                <div className="text-[10px] text-text-muted">Akumulasi agenda</div>
              </div>
            </div>
          </div>

          {/* Sticky Day Tabs Bar (Stippl Multi-Day Switcher) */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs border-b border-border px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveDay('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all ${
                activeDay === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-surface-alt text-text-body hover:bg-slate-200/70'
              }`}
            >
              Semua Hari ({daysCount})
            </button>

            {Array.from({ length: daysCount }, (_, i) => i + 1).map((dayNum) => {
              const isSelected = activeDay === dayNum
              const dayColor = getDayColor(dayNum)
              const dateSub = getDayDateLabel(currentTrip.startDate, dayNum)
              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => setActiveDay(dayNum)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all ${
                    isSelected
                      ? 'text-white border-transparent shadow-2xs'
                      : 'bg-white text-text-heading border-border hover:border-slate-300'
                  }`}
                  style={isSelected ? { backgroundColor: dayColor } : undefined}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: isSelected ? '#ffffff' : dayColor,
                    }}
                  />
                  <span>Hari {dayNum}</span>
                  {dateSub && (
                    <span
                      className={`text-[10px] font-medium ${
                        isSelected ? 'text-white/85' : 'text-text-muted'
                      }`}
                    >
                      • {dateSub}
                    </span>
                  )}
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => handleChangeDaysCount(1)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-primary bg-primary-bg hover:bg-teal-100/80 shrink-0 inline-flex items-center gap-1 transition-colors"
              title="Tambah Hari Baru"
            >
              <Plus size={13} />
              Hari
            </button>
          </div>

          {/* Main Itinerary Content Area */}
          <div className="p-4 sm:p-5 pb-28 lg:pb-12">
            {!isFormOpen && (
              <button
                id="btn-add-destination"
                onClick={() => {
                  setEditingEvent(null)
                  setFormDefaultDay(activeDay === 'all' ? 1 : activeDay)
                  setIsFormOpen(true)
                }}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white py-3 rounded-2xl font-bold text-xs sm:text-sm transition-colors shadow-xs mb-6 no-print"
              >
                <MapPinned size={17} />
                Tambah Destinasi Baru{' '}
                {activeDay !== 'all' ? `(Hari ${activeDay})` : ''}
              </button>
            )}

            {isFormOpen && (
              <TimelineForm
                key={editingEvent ? `edit-${editingEvent.id}` : `new-day-${formDefaultDay}`}
                daysCount={daysCount}
                startDate={currentTrip.startDate}
                defaultDayNumber={formDefaultDay}
                editingEvent={editingEvent}
                onAddEvent={handleAddEvent}
                onUpdateEvent={handleUpdateEvent}
                onCancel={() => {
                  setIsFormOpen(false)
                  setEditingEvent(null)
                }}
              />
            )}

            <TimelineView
              events={events ?? []}
              daysCount={daysCount}
              startDate={currentTrip.startDate}
              activeDay={activeDay}
              focusedEventId={focusedEventId}
              stopOrderMap={stopOrderMap}
              onFocusEvent={handleFocusEvent}
              onToggleComplete={handleToggleComplete}
              onEdit={handleEditEvent}
              onDelete={handleDeleteEvent}
              onQuickAddForDay={handleQuickAddForDay}
            />
          </div>
        </div>

        {/* RIGHT PANEL: Stippl Interactive Route Map */}
        <div
          className={`lg:col-span-6 xl:col-span-7 lg:h-full p-3 sm:p-4 bg-surface-subtle ${
            mobileTab === 'itinerary' ? 'hidden lg:block' : 'block h-[calc(100vh-7.5rem)]'
          }`}
        >
          <MapView
            events={events ?? []}
            activeDay={activeDay}
            focusedEventId={focusedEventId}
            stopOrderMap={stopOrderMap}
            onSelectEvent={(ev) => setFocusedEventId(String(ev.id))}
          />
        </div>
      </div>

      {/* ── Mobile Bottom View Switcher (Jadwal vs Peta Rute) ── */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 lg:hidden bg-slate-900/95 text-white p-1.5 rounded-2xl shadow-xl flex items-center gap-1 border border-slate-700 no-print">
        <button
          type="button"
          onClick={() => setMobileTab('itinerary')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            mobileTab === 'itinerary'
              ? 'bg-primary text-white'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <ListChecks size={14} />
          Rundown ({tripStats.totalEvents})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            mobileTab === 'map'
              ? 'bg-primary text-white'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <MapIcon size={14} />
          Peta Rute ({tripStats.pinnedCount})
        </button>
      </div>

      {/* ── Undo Delete Toast ── */}
      {deletedEventBackup && (
        <div className="fixed bottom-16 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs animate-fade-in-up">
          <span>Destinasi &ldquo;{deletedEventBackup.title}&rdquo; dihapus.</span>
          <button
            onClick={handleUndoDeleteEvent}
            className="inline-flex items-center gap-1 font-extrabold text-teal-300 hover:text-teal-200 underline"
          >
            <Undo2 size={13} />
            Urungkan
          </button>
          <button
            onClick={() => setDeletedEventBackup(null)}
            className="text-slate-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Notification Toast ── */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      {/* ── Supabase Hybrid Modal ── */}
      {showCloudModal && (
        <SupabaseModal
          onClose={() => setShowCloudModal(false)}
          onSyncSuccess={() => setCloudConnected(isSupabaseConfigured())}
        />
      )}
    </div>
  )
}
