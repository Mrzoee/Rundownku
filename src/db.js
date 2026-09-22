import Dexie from 'dexie'

export const db = new Dexie('RundownDB')

// v2: trips sekarang menyimpan banyak rundown (histori)
db.version(2).stores({
  trips: '++id, createdAt',
  events: '++id, tripId, startTime',
}).upgrade(async (tx) => {
  // Tambah createdAt ke trip lama yang belum punya
  await tx.trips.toCollection().modify((trip) => {
    if (!trip.createdAt) trip.createdAt = Date.now()
  })
})

// Tetap support schema v1 agar tidak rusak data lama
db.version(1).stores({
  trips: '++id',
  events: '++id, tripId, startTime',
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Ambil semua rundown, urut terbaru dulu */
export async function getAllTrips() {
  return db.trips.orderBy('createdAt').reverse().toArray()
}

/** Buat rundown baru, kembalikan object trip-nya */
export async function createTrip(title = 'Rundown Baru') {
  const id = await db.trips.add({
    title,
    date: '',
    createdAt: Date.now(),
  })
  return db.trips.get(id)
}

/** Migrasi data localStorage lama (hanya sekali) */
export async function migrateFromLocalStorage() {
  const saved = localStorage.getItem('itineraryData')
  if (!saved) return

  try {
    const parsed = JSON.parse(saved)
    const id = await db.trips.add({
      title: parsed.title ?? 'Rundown Lama',
      date: parsed.date ?? '',
      createdAt: Date.now(),
    })
    if (Array.isArray(parsed.events)) {
      for (const ev of parsed.events) {
        await db.events.add({
          tripId: id,
          title: ev.title,
          startTime: ev.startTime,
          endTime: ev.endTime ?? '',
          locationName: ev.locationName ?? '',
          lat: ev.lat ?? null,
          lng: ev.lng ?? null,
        })
      }
    }
    localStorage.removeItem('itineraryData')
  } catch {
    // abaikan error parse
  }
}
