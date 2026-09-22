import { MapPin, Clock, Trash2, Pencil } from 'lucide-react'

export default function TimelineView({ events, onDelete, onEdit }) {
  const sorted = [...events].sort((a, b) => a.startTime.localeCompare(b.startTime))

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted">
        <MapPin size={44} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">Belum ada destinasi.</p>
        <p className="text-sm mt-1">Mulai buat rundown seru kamu!</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-4 md:left-1/2 md:-translate-x-px top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-10">
        {sorted.map((event, index) => {
          const isLeft = index % 2 === 0
          return (
            <div key={event.id} className="relative animate-fade-in-up" style={{ animationDelay: `${index * 80}ms` }}>
              {/* Dot */}
              <div className="absolute left-4 md:left-1/2 top-5 -translate-x-1/2 z-10">
                <div className="w-4 h-4 rounded-full bg-primary border-[3px] border-white shadow-md" />
              </div>

              {/* Mobile */}
              <div className="block md:hidden pl-10">
                <Card event={event} onDelete={onDelete} onEdit={onEdit} />
              </div>

              {/* Desktop alternating */}
              <div className="hidden md:grid md:grid-cols-2 md:gap-10 items-start">
                {isLeft ? (
                  <>
                    <div className="flex justify-end pr-8"><Card event={event} onDelete={onDelete} onEdit={onEdit} /></div>
                    <div className="flex items-center pl-8 pt-3"><TimeBadge event={event} /></div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-end pr-8 pt-3"><TimeBadge event={event} /></div>
                    <div className="pl-8"><Card event={event} onDelete={onDelete} onEdit={onEdit} /></div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimeBadge({ event }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm">
      <Clock size={12} />
      <span>{event.startTime}</span>
      {event.endTime && <><span className="opacity-60">–</span><span>{event.endTime}</span></>}
    </div>
  )
}

function Card({ event, onDelete, onEdit }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-border hover:shadow-md transition-shadow w-full max-w-sm group">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-text-heading text-base leading-snug">{event.title}</h3>

          {/* Waktu mobile */}
          <div className="flex items-center gap-1.5 mt-1.5 text-primary text-xs font-semibold md:hidden">
            <Clock size={13} />
            <span>{event.startTime}</span>
            {event.endTime && <><span className="text-text-muted mx-0.5">–</span><span>{event.endTime}</span></>}
          </div>

          {/* Lokasi */}
          {event.locationName && (
            <div className="flex items-start gap-1.5 mt-2">
              <MapPin size={13} className="text-text-muted shrink-0 mt-0.5" />
              <span className="text-xs text-text-muted leading-snug line-clamp-2">{event.locationName}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(event)}
            className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-bg transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Edit destinasi"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(event.id)}
            className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-red-50 transition-colors"
            aria-label="Hapus destinasi"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
