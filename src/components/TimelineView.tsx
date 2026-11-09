import {
  MapPin,
  Clock,
  Trash2,
  Pencil,
  Navigation,
  CheckCircle2,
  Circle,
  Wallet,
  FileText,
  Plus,
  Route,
  AlertTriangle,
} from 'lucide-react'
import type { TimelineEvent } from '../types'
import {
  CATEGORY_MAP,
  calculateDistanceKm,
  estimateTravelTime,
  formatCurrencyIDR,
  formatDistance,
  getDayColor,
  getDayDateLabel,
  getEventDurationLabel,
  sortEventsChronologically,
} from '../utils/geo'

interface TimelineViewProps {
  events: TimelineEvent[]
  daysCount: number
  startDate: string
  activeDay: number | 'all'
  focusedEventId: string | null
  stopOrderMap: Map<string, number>
  onFocusEvent: (event: TimelineEvent) => void
  onToggleComplete: (event: TimelineEvent) => void
  onEdit: (event: TimelineEvent) => void
  onDelete: (id: string) => void
  onQuickAddForDay: (dayNumber: number) => void
}

function openSegmentDirections(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
) {
  const url = `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=driving`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export default function TimelineView({
  events,
  daysCount,
  startDate,
  activeDay,
  focusedEventId,
  stopOrderMap,
  onFocusEvent,
  onToggleComplete,
  onEdit,
  onDelete,
  onQuickAddForDay,
}: TimelineViewProps) {
  const sortedAll = sortEventsChronologically(events)

  const daysToRender =
    activeDay === 'all'
      ? Array.from({ length: Math.max(1, daysCount) }, (_, i) => i + 1)
      : [activeDay]

  if (sortedAll.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-border p-10 text-center text-text-muted">
        <div className="w-12 h-12 rounded-2xl bg-primary-bg text-primary flex items-center justify-center mx-auto mb-3">
          <MapPin size={24} />
        </div>
        <p className="font-bold text-text-heading text-sm">
          Belum ada destinasi di perjalanan ini
        </p>
        <p className="text-xs mt-1 max-w-xs mx-auto leading-relaxed">
          Tambahkan titik destinasi pertama Anda untuk melihat garis rute otomatis di peta.
        </p>
        <button
          onClick={() => onQuickAddForDay(activeDay === 'all' ? 1 : activeDay)}
          className="mt-4 inline-flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={15} />
          Tambah Destinasi Pertama
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {daysToRender.map((dayNum) => {
        const dayEvents = sortedAll.filter((ev) => (ev.dayNumber || 1) === dayNum)
        const dayColor = getDayColor(dayNum)
        const dayDateLabel = getDayDateLabel(startDate, dayNum)
        const dayBudget = dayEvents.reduce((sum, e) => sum + (e.estimatedCost || 0), 0)

        // Hitung total jarak rute pada hari ini
        const pinnedInDay = dayEvents.filter(
          (e) => e.lat !== null && e.lng !== null
        )
        let dayDistanceKm = 0
        for (let i = 0; i < pinnedInDay.length - 1; i++) {
          dayDistanceKm += calculateDistanceKm(
            pinnedInDay[i].lat!,
            pinnedInDay[i].lng!,
            pinnedInDay[i + 1].lat!,
            pinnedInDay[i + 1].lng!
          )
        }

        return (
          <section key={dayNum} className="space-y-3">
            {/* Day Header Banner (Stippl style) */}
            <div className="flex items-center justify-between gap-2 bg-white border border-border rounded-2xl px-4 py-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-8 h-8 rounded-xl text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs"
                  style={{ backgroundColor: dayColor }}
                >
                  H{dayNum}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-text-heading text-sm">
                      Hari {dayNum}
                    </h3>
                    {dayDateLabel && (
                      <span className="text-xs font-semibold text-text-muted">
                        • {dayDateLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-text-muted mt-0.5">
                    <span>{dayEvents.length} destinasi</span>
                    {dayDistanceKm > 0 && (
                      <span className="inline-flex items-center gap-1 font-medium text-teal-700">
                        <Route size={11} />
                        {formatDistance(dayDistanceKm)}
                      </span>
                    )}
                    {dayBudget > 0 && (
                      <span className="font-medium text-amber-700">
                        {formatCurrencyIDR(dayBudget)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onQuickAddForDay(dayNum)}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary-bg px-3 py-1.5 rounded-xl transition-colors shrink-0"
              >
                <Plus size={14} />
                <span>Tambah</span>
              </button>
            </div>

            {/* Daftar Destinasi pada Hari Ini */}
            {dayEvents.length === 0 ? (
              <div className="bg-white/70 border border-dashed border-border rounded-2xl p-6 text-center">
                <p className="text-xs text-text-muted">
                  Belum ada agenda untuk Hari {dayNum}.
                </p>
                <button
                  onClick={() => onQuickAddForDay(dayNum)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <Plus size={13} />
                  Tambah destinasi di Hari {dayNum}
                </button>
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-7 space-y-2">
                {/* Vertical connector line */}
                <div
                  className="absolute left-3 sm:left-3.5 top-4 bottom-4 w-0.5 rounded-full opacity-35"
                  style={{ backgroundColor: dayColor }}
                />

                {dayEvents.map((event, idx) => {
                  const stopNum = stopOrderMap.get(String(event.id))
                  const isFocused = focusedEventId === String(event.id)
                  const catMeta = CATEGORY_MAP[event.category] ?? CATEGORY_MAP.wisata
                  const durationLabel = getEventDurationLabel(
                    event.startTime,
                    event.endTime
                  )

                  // Cek apakah jadwal bentrok dengan agenda sebelumnya pada hari yang sama
                  const prevEvent = idx > 0 ? dayEvents[idx - 1] : null
                  const hasTimeOverlap = Boolean(
                    prevEvent &&
                      prevEvent.endTime &&
                      event.startTime < prevEvent.endTime
                  )

                  // Hitung jarak ke destinasi berikutnya di hari yang sama jika keduanya punya koordinat
                  const nextEvent =
                    idx < dayEvents.length - 1 ? dayEvents[idx + 1] : null
                  const canCalcLeg =
                    event.lat !== null &&
                    event.lng !== null &&
                    nextEvent &&
                    nextEvent.lat !== null &&
                    nextEvent.lng !== null

                  const legDistKm = canCalcLeg
                    ? calculateDistanceKm(
                        event.lat!,
                        event.lng!,
                        nextEvent!.lat!,
                        nextEvent!.lng!
                      )
                    : null

                  return (
                    <div key={event.id} className="relative">
                      {/* Pin Number / Timeline Node */}
                      <button
                        type="button"
                        onClick={() => onFocusEvent(event)}
                        title={
                          stopNum
                            ? `Titik peta #${stopNum} - Klik untuk lihat di peta`
                            : event.title
                        }
                        className="absolute -left-6 sm:-left-7 top-4 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shadow-xs transition-transform hover:scale-110 z-10 border-2 border-white"
                        style={{
                          backgroundColor: stopNum ? dayColor : '#94a3b8',
                        }}
                      >
                        {stopNum ?? '•'}
                      </button>

                      {/* Event Card */}
                      <div
                        onClick={() => onFocusEvent(event)}
                        className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer ${
                          isFocused
                            ? 'border-primary ring-2 ring-primary/20 shadow-md'
                            : 'border-border hover:border-primary/40 hover:shadow-xs'
                        } ${event.completed ? 'opacity-75 bg-slate-50/70' : ''}`}
                      >
                        {hasTimeOverlap && (
                          <div className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                            <AlertTriangle size={12} />
                            Jadwal beririsan dengan agenda sebelumnya ({prevEvent?.endTime})
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {/* Top Meta Row: Time + Category + Duration */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-text-heading bg-surface-subtle px-2.5 py-0.5 rounded-lg">
                                <Clock size={12} className="text-primary" />
                                {event.startTime}
                                {event.endTime ? ` – ${event.endTime}` : ''}
                              </span>

                              {durationLabel && (
                                <span className="text-[11px] font-semibold text-text-muted">
                                  ({durationLabel})
                                </span>
                              )}

                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${catMeta.bgClass} ${catMeta.textClass} ${catMeta.borderClass}`}
                              >
                                {catMeta.label}
                              </span>
                            </div>

                            {/* Title */}
                            <h4
                              className={`font-extrabold text-text-heading text-sm sm:text-base leading-snug ${
                                event.completed ? 'line-through text-text-muted' : ''
                              }`}
                            >
                              {event.title}
                            </h4>

                            {/* Location */}
                            {event.locationName && (
                              <div className="flex items-start gap-1.5 mt-1.5">
                                <MapPin
                                  size={13}
                                  className="text-primary shrink-0 mt-0.5"
                                />
                                <span className="text-xs text-text-muted leading-snug line-clamp-2">
                                  {event.locationName}
                                </span>
                              </div>
                            )}

                            {/* Notes */}
                            {event.notes && (
                              <div className="flex items-start gap-1.5 mt-2 bg-surface-alt px-2.5 py-1.5 rounded-xl border border-border-light">
                                <FileText
                                  size={12}
                                  className="text-text-muted shrink-0 mt-0.5"
                                />
                                <p className="text-xs text-text-body leading-relaxed">
                                  {event.notes}
                                </p>
                              </div>
                            )}

                            {/* Cost badge */}
                            {event.estimatedCost > 0 && (
                              <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/70 px-2.5 py-0.5 rounded-lg">
                                <Wallet size={12} className="text-amber-600" />
                                {formatCurrencyIDR(event.estimatedCost)}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons (Always visible on mobile & desktop) */}
                          <div
                            className="flex items-center gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => onToggleComplete(event)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                event.completed
                                  ? 'text-emerald-600 hover:bg-emerald-50'
                                  : 'text-text-muted hover:text-emerald-600 hover:bg-surface-alt'
                              }`}
                              title={
                                event.completed
                                  ? 'Tandai belum selesai'
                                  : 'Tandai sudah dikunjungi'
                              }
                              aria-label="Toggle selesai"
                            >
                              {event.completed ? (
                                <CheckCircle2 size={16} />
                              ) : (
                                <Circle size={16} />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => onEdit(event)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-bg transition-colors"
                              title="Edit destinasi"
                              aria-label="Edit destinasi"
                            >
                              <Pencil size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDelete(event.id)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-rose-50 transition-colors"
                              title="Hapus destinasi"
                              aria-label="Hapus destinasi"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Stippl-style Route Transition Connector to Next Stop */}
                      {legDistKm !== null && nextEvent && (
                        <div className="my-2 ml-2 flex items-center justify-between gap-2 bg-teal-50/70 border border-teal-200/70 rounded-xl px-3 py-1.5 text-[11px] text-teal-900">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Route size={13} className="text-primary shrink-0" />
                            <span className="font-bold">
                              {formatDistance(legDistKm)}
                            </span>
                            <span className="text-teal-700">•</span>
                            <span className="text-teal-800 truncate">
                              {estimateTravelTime(legDistKm)} ke{' '}
                              <strong>{nextEvent.title}</strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              openSegmentDirections(
                                event.lat!,
                                event.lng!,
                                nextEvent.lat!,
                                nextEvent.lng!
                              )
                            }
                            className="inline-flex items-center gap-1 font-bold text-primary hover:underline shrink-0"
                            title="Buka navigasi segmen ini di Google Maps"
                          >
                            <Navigation size={11} />
                            Rute
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
