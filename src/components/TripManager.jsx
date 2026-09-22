import { useState } from 'react'
import { Plus, MapPinned, ChevronRight, Trash2, Calendar, X } from 'lucide-react'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatCreatedAt(ts) {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function TripManager({ trips, onSelect, onCreate, onDelete }) {
  const [showConfirm, setShowConfirm] = useState(null) // id trip yang mau dihapus

  const handleDelete = (e, id) => {
    e.stopPropagation()
    setShowConfirm(id)
  }

  const confirmDelete = () => {
    onDelete(showConfirm)
    setShowConfirm(null)
  }

  return (
    <div className="min-h-screen bg-surface-alt">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 pt-12 pb-8">
        <div className="max-w-xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 bg-primary-bg text-primary text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
            <MapPinned size={14} />
            Rundown Planner
          </div>
          <h1 className="text-3xl font-bold text-text-heading">Rundown Saya</h1>
          <p className="text-sm text-text-muted mt-2">Semua itinerary perjalanan kamu tersimpan di sini</p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 mt-8 pb-24">
        {/* Tombol buat baru */}
        <button
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white py-3.5 rounded-2xl font-semibold text-sm transition-colors shadow-md mb-6"
        >
          <Plus size={18} />
          Buat Rundown Baru
        </button>

        {/* List rundown */}
        {trips.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            <MapPinned size={44} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Belum ada rundown.</p>
            <p className="text-sm mt-1">Mulai buat itinerary perjalanan pertama kamu!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => onSelect(trip)}
                className="bg-white rounded-2xl border border-border p-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
              >
                {/* Ikon */}
                <div className="w-11 h-11 rounded-xl bg-primary-bg flex items-center justify-center shrink-0">
                  <MapPinned size={20} className="text-primary" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-text-heading text-sm truncate">{trip.title}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    {trip.date ? (
                      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                        <Calendar size={11} />
                        {formatDate(trip.date)}
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">Tanggal belum diset</span>
                    )}
                    <span className="text-xs text-text-muted">
                      Dibuat {formatCreatedAt(trip.createdAt ?? Date.now())}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => handleDelete(e, trip.id)}
                    className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Hapus rundown"
                  >
                    <Trash2 size={15} />
                  </button>
                  <ChevronRight size={18} className="text-text-muted group-hover:text-primary transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal konfirmasi hapus */}
      {showConfirm !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-bold text-text-heading">Hapus Rundown?</h3>
              <button onClick={() => setShowConfirm(null)} className="text-text-muted hover:text-danger">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-text-muted mb-5">
              Semua destinasi di rundown ini akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-heading hover:bg-surface-alt transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
