import Dexie, { type Table } from 'dexie'
import type { NewTimelineEventInput, TimelineEvent, Trip } from './types'
import {
  deleteEventCloud,
  deleteTripCloud,
  eventToRow,
  getSupabaseClient,
  pushEventCloud,
  pushTripCloud,
  rowToEvent,
  rowToTrip,
  tripToRow,
} from './lib/supabase'
import { getDaysCountBetween } from './utils/geo'

class RundownDatabase extends Dexie {
  trips!: Table<Trip, string | number>
  events!: Table<TimelineEvent, string | number>

  constructor() {
    super('RundownDB')

    // v3: Stippl-style multi-day itinerary schema
    this.version(3)
      .stores({
        trips: '++id, createdAt, updatedAt',
        events: '++id, tripId, dayNumber, startTime',
      })
      .upgrade(async (tx) => {
        await tx
          .table('trips')
          .toCollection()
          .modify((trip: Record<string, unknown>) => {
            const legacyDate = typeof trip.date === 'string' ? trip.date : ''
            if (!trip.startDate) trip.startDate = legacyDate
            if (!trip.endDate) trip.endDate = legacyDate
            if (!trip.daysCount) trip.daysCount = 1
            if (!trip.description) trip.description = ''
            if (!trip.createdAt) trip.createdAt = Date.now()
            if (!trip.updatedAt) trip.updatedAt = Date.now()
          })

        await tx
          .table('events')
          .toCollection()
          .modify((ev: Record<string, unknown>) => {
            if (!ev.dayNumber) ev.dayNumber = 1
            if (!ev.category) ev.category = 'wisata'
            if (!ev.notes) ev.notes = ''
            if (ev.estimatedCost === undefined) ev.estimatedCost = 0
            if (ev.completed === undefined) ev.completed = false
            if (!ev.createdAt) ev.createdAt = Date.now()
          })
      })

    // v2: histori trips
    this.version(2).stores({
      trips: '++id, createdAt',
      events: '++id, tripId, startTime',
    })

    // v1: schema awal
    this.version(1).stores({
      trips: '++id',
      events: '++id, tripId, startTime',
    })
  }
}

export const db = new RundownDatabase()

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 9)
  return `${prefix}_${Date.now()}_${rand}`
}

/** Normalisasi record Trip dari Dexie (id bisa number dari v1/v2 atau string dari v3) */
function normalizeTrip(raw: Trip & { date?: string }): Trip {
  const startDate = raw.startDate ?? raw.date ?? ''
  const endDate = raw.endDate || startDate
  const computedDays = startDate && endDate ? getDaysCountBetween(startDate, endDate) : 1
  return {
    id: String(raw.id),
    title: raw.title || 'Rundown Baru',
    description: raw.description ?? '',
    startDate,
    endDate,
    daysCount: Math.max(raw.daysCount || 1, computedDays),
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? raw.createdAt ?? Date.now(),
  }
}

function normalizeEvent(raw: TimelineEvent): TimelineEvent {
  return {
    id: String(raw.id),
    tripId: String(raw.tripId),
    dayNumber: Number(raw.dayNumber) || 1,
    title: raw.title || 'Destinasi',
    startTime: raw.startTime || '09:00',
    endTime: raw.endTime ?? '',
    category: raw.category ?? 'wisata',
    locationName: raw.locationName ?? '',
    lat: raw.lat !== null && raw.lat !== undefined ? Number(raw.lat) : null,
    lng: raw.lng !== null && raw.lng !== undefined ? Number(raw.lng) : null,
    notes: raw.notes ?? '',
    estimatedCost: Number(raw.estimatedCost) || 0,
    completed: Boolean(raw.completed),
    createdAt: raw.createdAt ?? Date.now(),
  }
}

/** Ambil semua rundown, urut terbaru dulu */
export async function getAllTrips(): Promise<Trip[]> {
  const list = await db.trips.toArray()
  return list
    .map((t) => normalizeTrip(t as Trip & { date?: string }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Ambil 1 trip berdasarkan ID (mendukung pencocokan string maupun number dari versi lama) */
export async function getTripById(id: string): Promise<Trip | null> {
  let found = await db.trips.get(id)
  if (!found && !isNaN(Number(id))) {
    found = await db.trips.get(Number(id))
  }
  return found ? normalizeTrip(found as Trip & { date?: string }) : null
}

/** Ambil semua event untuk sebuah tripId */
export async function getEventsByTripId(tripId: string): Promise<TimelineEvent[]> {
  const all = await db.events.toArray()
  return all
    .filter((ev) => String(ev.tripId) === String(tripId))
    .map(normalizeEvent)
    .sort((a, b) => {
      if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber
      return a.startTime.localeCompare(b.startTime)
    })
}

/** Buat rundown baru */
export async function createTrip(
  title = 'Petualangan Baru',
  options?: Partial<Pick<Trip, 'description' | 'startDate' | 'endDate' | 'daysCount'>>
): Promise<Trip> {
  const now = Date.now()
  const startDate = options?.startDate ?? ''
  const endDate = options?.endDate ?? startDate
  const daysCount =
    options?.daysCount ??
    (startDate && endDate ? getDaysCountBetween(startDate, endDate) : 3)

  const newTrip: Trip = {
    id: generateId('trip'),
    title,
    description: options?.description ?? '',
    startDate,
    endDate,
    daysCount: Math.max(1, daysCount),
    createdAt: now,
    updatedAt: now,
  }

  await db.trips.put(newTrip)
  void pushTripCloud(newTrip)
  return newTrip
}

/** Update properti trip */
export async function updateTrip(
  id: string,
  changes: Partial<Omit<Trip, 'id' | 'createdAt'>>
): Promise<Trip | null> {
  const existing = await getTripById(id)
  if (!existing) return null

  // Cari key asli di Dexie (bisa number jika data lama)
  const rawKey = (await db.trips.get(id)) ? id : Number(id)
  const updated: Trip = {
    ...existing,
    ...changes,
    id: existing.id,
    updatedAt: Date.now(),
  }

  await db.trips.update(rawKey, {
    title: updated.title,
    description: updated.description,
    startDate: updated.startDate,
    endDate: updated.endDate,
    daysCount: updated.daysCount,
    updatedAt: updated.updatedAt,
  })
  void pushTripCloud(updated)
  return updated
}

/** Hapus trip beserta seluruh event di dalamnya */
export async function deleteTrip(id: string): Promise<void> {
  const allEvents = await db.events.toArray()
  for (const ev of allEvents) {
    if (String(ev.tripId) === String(id)) {
      await db.events.delete(ev.id)
    }
  }
  await db.trips.delete(id)
  if (!isNaN(Number(id))) {
    await db.trips.delete(Number(id))
  }
  void deleteTripCloud(String(id))
}

/** Duplikat rundown beserta semua destinasinya */
export async function duplicateTrip(id: string): Promise<Trip | null> {
  const sourceTrip = await getTripById(id)
  if (!sourceTrip) return null
  const sourceEvents = await getEventsByTripId(id)

  const clonedTrip = await createTrip(`${sourceTrip.title} (Salinan)`, {
    description: sourceTrip.description,
    startDate: sourceTrip.startDate,
    endDate: sourceTrip.endDate,
    daysCount: sourceTrip.daysCount,
  })

  for (const ev of sourceEvents) {
    await addEvent(clonedTrip.id, {
      dayNumber: ev.dayNumber,
      title: ev.title,
      startTime: ev.startTime,
      endTime: ev.endTime,
      category: ev.category,
      locationName: ev.locationName,
      lat: ev.lat,
      lng: ev.lng,
      notes: ev.notes,
      estimatedCost: ev.estimatedCost,
      completed: false,
    })
  }

  return clonedTrip
}

/** Tambah destinasi/agenda baru ke dalam trip */
export async function addEvent(
  tripId: string,
  input: NewTimelineEventInput
): Promise<TimelineEvent> {
  const newEv: TimelineEvent = {
    id: generateId('ev'),
    tripId: String(tripId),
    dayNumber: Number(input.dayNumber) || 1,
    title: input.title,
    startTime: input.startTime,
    endTime: input.endTime ?? '',
    category: input.category ?? 'wisata',
    locationName: input.locationName ?? '',
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    notes: input.notes ?? '',
    estimatedCost: Number(input.estimatedCost) || 0,
    completed: Boolean(input.completed),
    createdAt: Date.now(),
  }

  await db.events.put(newEv)
  await updateTrip(tripId, {})
  void pushEventCloud(newEv)
  return newEv
}

/** Update destinasi/agenda */
export async function updateEvent(
  eventId: string,
  changes: Partial<NewTimelineEventInput>
): Promise<void> {
  const rawKey = (await db.events.get(eventId)) ? eventId : Number(eventId)
  const existingRaw = await db.events.get(rawKey)
  if (!existingRaw) return

  const updated = normalizeEvent({
    ...existingRaw,
    ...changes,
  })

  await db.events.update(rawKey, {
    dayNumber: updated.dayNumber,
    title: updated.title,
    startTime: updated.startTime,
    endTime: updated.endTime,
    category: updated.category,
    locationName: updated.locationName,
    lat: updated.lat,
    lng: updated.lng,
    notes: updated.notes,
    estimatedCost: updated.estimatedCost,
    completed: updated.completed,
  })
  await updateTrip(updated.tripId, {})
  void pushEventCloud(updated)
}

/** Hapus destinasi */
export async function deleteEvent(eventId: string): Promise<void> {
  await db.events.delete(eventId)
  if (!isNaN(Number(eventId))) {
    await db.events.delete(Number(eventId))
  }
  void deleteEventCloud(String(eventId))
}

/** Sinkronisasi dua arah antara IndexedDB Lokal dan Supabase */
export async function syncWithSupabase(): Promise<{
  syncedTrips: number
  syncedEvents: number
  error?: string
}> {
  const client = getSupabaseClient()
  if (!client) {
    return { syncedTrips: 0, syncedEvents: 0, error: 'Supabase belum dikonfigurasi' }
  }

  try {
    // 1. Ambil data lokal
    const localTrips = await getAllTrips()
    const rawEvents = await db.events.toArray()
    const localEvents = rawEvents.map(normalizeEvent)

    // 2. Push data lokal ke Supabase
    if (localTrips.length > 0) {
      const { error: tripPushErr } = await client
        .from('trips')
        .upsert(localTrips.map(tripToRow), { onConflict: 'id' })
      if (tripPushErr) throw new Error(tripPushErr.message)
    }

    if (localEvents.length > 0) {
      const { error: evPushErr } = await client
        .from('events')
        .upsert(localEvents.map(eventToRow), { onConflict: 'id' })
      if (evPushErr) throw new Error(evPushErr.message)
    }

    // 3. Tarik data dari Supabase yang belum ada / lebih baru di Cloud
    const { data: remoteTrips, error: tripFetchErr } = await client
      .from('trips')
      .select('*')
    if (tripFetchErr) throw new Error(tripFetchErr.message)

    const { data: remoteEvents, error: evFetchErr } = await client
      .from('events')
      .select('*')
    if (evFetchErr) throw new Error(evFetchErr.message)

    const localTripIds = new Set(localTrips.map((t) => String(t.id)))
    let pulledTrips = 0
    for (const rRow of remoteTrips ?? []) {
      const rTrip = rowToTrip(rRow)
      if (!localTripIds.has(String(rTrip.id))) {
        await db.trips.put(rTrip)
        pulledTrips++
      }
    }

    const localEventIds = new Set(localEvents.map((e) => String(e.id)))
    let pulledEvents = 0
    for (const rEvRow of remoteEvents ?? []) {
      const rEv = rowToEvent(rEvRow)
      if (!localEventIds.has(String(rEv.id))) {
        await db.events.put(rEv)
        pulledEvents++
      }
    }

    return {
      syncedTrips: localTrips.length + pulledTrips,
      syncedEvents: localEvents.length + pulledEvents,
    }
  } catch (err) {
    return {
      syncedTrips: 0,
      syncedEvents: 0,
      error: err instanceof Error ? err.message : 'Gagal sinkronisasi ke Supabase',
    }
  }
}

/** Migrasi data localStorage lama + seed contoh perjalanan ala Stippl jika database benar-benar kosong */
export async function initializeDatabase(): Promise<void> {
  const saved = localStorage.getItem('itineraryData')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      const trip = await createTrip(parsed.title ?? 'Rundown Lama', {
        startDate: parsed.date ?? '',
        endDate: parsed.date ?? '',
        daysCount: 1,
      })
      if (Array.isArray(parsed.events)) {
        for (const ev of parsed.events) {
          await addEvent(trip.id, {
            dayNumber: 1,
            title: ev.title,
            startTime: ev.startTime,
            endTime: ev.endTime ?? '',
            category: 'wisata',
            locationName: ev.locationName ?? '',
            lat: ev.lat ?? null,
            lng: ev.lng ?? null,
            notes: '',
            estimatedCost: 0,
            completed: false,
          })
        }
      }
      localStorage.removeItem('itineraryData')
    } catch {
      // abaikan error parse
    }
  }

  // Jika pengguna belum punya trip sama sekali dan belum pernah inisialisasi, buat 1 contoh itinerary multi-hari ala Stippl
  const seeded = localStorage.getItem('rundownku_v3_seeded')
  const count = await db.trips.count()
  if (!seeded && count === 0) {
    localStorage.setItem('rundownku_v3_seeded', '1')
    const sampleTrip = await createTrip('Eksplorasi Bandung & Lembang 2 Hari', {
      description: 'Itinerary kuliner legendaris, jalan santai di Braga, dan udara sejuk Lembang.',
      startDate: '2026-11-14',
      endDate: '2026-11-15',
      daysCount: 2,
    })

    const sampleEvents: NewTimelineEventInput[] = [
      {
        dayNumber: 1,
        title: 'Sarapan Kopi & Roti Bakar Kopi Toko Djawa',
        startTime: '08:00',
        endTime: '09:30',
        category: 'kuliner',
        locationName: 'Jl. Braga No. 81, Bandung',
        lat: -6.9178,
        lng: 107.6095,
        notes: 'Coba Es Kopi Toko Djawa & roti bakar srikaya sambil jalan pagi di koridor Braga.',
        estimatedCost: 65000,
        completed: true,
      },
      {
        dayNumber: 1,
        title: 'Gedung Sate & Museum Geologi Bandung',
        startTime: '10:00',
        endTime: '12:30',
        category: 'wisata',
        locationName: 'Jl. Diponegoro No. 57, Bandung',
        lat: -6.9025,
        lng: 107.6188,
        notes: 'Foto di pelataran taman Gedung Sate lalu lanjut jalan kaki ke Museum Geologi.',
        estimatedCost: 25000,
        completed: false,
      },
      {
        dayNumber: 1,
        title: 'Makan Siang Sunda di Warung Nasi Ibu Imas',
        startTime: '13:00',
        endTime: '14:30',
        category: 'kuliner',
        locationName: 'Jl. Balonggede No. 67, Bandung',
        lat: -6.9248,
        lng: 107.6062,
        notes: 'Wajib pesan ayam bakar, karedok leunca, dan sambal dadak.',
        estimatedCost: 85000,
        completed: false,
      },
      {
        dayNumber: 1,
        title: 'Sore Santai di Tahura Ir. H. Djuanda (Dago Pakar)',
        startTime: '15:30',
        endTime: '17:45',
        category: 'wisata',
        locationName: 'Kompleks Tahura Dago Pakar, Bandung',
        lat: -6.8569,
        lng: 107.6305,
        notes: 'Jalan santai di bawah hutan pinus & kunjungi Goa Jepang/Belanda.',
        estimatedCost: 35000,
        completed: false,
      },
      {
        dayNumber: 2,
        title: 'Sunrise & Kawah Ratu Tangkuban Parahu',
        startTime: '07:30',
        endTime: '10:00',
        category: 'wisata',
        locationName: 'Cikole, Lembang, Bandung Barat',
        lat: -6.7596,
        lng: 107.6098,
        notes: 'Bawa jaket hangat karena suhu pagi di kawah cukup dingin.',
        estimatedCost: 50000,
        completed: false,
      },
      {
        dayNumber: 2,
        title: 'Orchid Forest Cikole',
        startTime: '10:30',
        endTime: '13:00',
        category: 'wisata',
        locationName: 'Genteng, Cikole, Lembang',
        lat: -6.7804,
        lng: 107.6375,
        notes: 'Wood Bridge di tengah hutan pinus dan rumah koleksi anggrek.',
        estimatedCost: 60000,
        completed: false,
      },
      {
        dayNumber: 2,
        title: 'Oleh-oleh Bolu Susu & Tahu Susu Lembang',
        startTime: '13:30',
        endTime: '15:00',
        category: 'belanja',
        locationName: 'Jl. Raya Lembang No. 177, Bandung Barat',
        lat: -6.8183,
        lng: 107.6174,
        notes: 'Makan tahu susu hangat di tempat & beli oleh-oleh sebelum pulang.',
        estimatedCost: 120000,
        completed: false,
      },
    ]

    for (const ev of sampleEvents) {
      await addEvent(sampleTrip.id, ev)
    }
  }
}
