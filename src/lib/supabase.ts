import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SupabaseConfig, TimelineEvent, Trip } from '../types'

const STORAGE_KEY = 'rundownku_supabase_config'
const DEFAULT_SUPABASE_URL = 'https://dwidlwhqrlrcqjrhqxue.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3aWRsd2hxcmxyY3FqcmhxeHVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxODUwMTQsImV4cCI6MjEwOTc2MTAxNH0.EpWuu9gRvWSyNel90vIFlpl3aNpNpm6U8G2PKlBtraU'

let cachedClient: SupabaseClient | null = null
let cachedConfigKey = ''

export function getSupabaseConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SupabaseConfig
      if (parsed.url?.trim() && parsed.anonKey?.trim()) {
        return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() }
      }
    }
  } catch {
    // ignore storage errors
  }

  const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL
  const envKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY

  if (
    envUrl &&
    envKey &&
    !envUrl.includes('your-project-id') &&
    !envKey.includes('your-anon-key')
  ) {
    return { url: envUrl, anonKey: envKey }
  }

  return null
}

export function saveSupabaseConfig(config: SupabaseConfig | null): void {
  if (!config || !config.url.trim() || !config.anonKey.trim()) {
    localStorage.removeItem(STORAGE_KEY)
    cachedClient = null
    cachedConfigKey = ''
    return
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      url: config.url.trim(),
      anonKey: config.anonKey.trim(),
    })
  )
  cachedClient = null
  cachedConfigKey = ''
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig()
  if (!config) return null

  const key = `${config.url}::${config.anonKey}`
  if (cachedClient && cachedConfigKey === key) {
    return cachedClient
  }

  try {
    cachedClient = createClient(config.url, config.anonKey)
    cachedConfigKey = key
    return cachedClient
  } catch {
    return null
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null
}

// ── Row Mappers (CamelCase <-> SnakeCase) ────────────────────────────────────

interface SupabaseTripRow {
  id: string
  title: string
  description: string
  start_date: string
  end_date: string
  days_count: number
  created_at: number
  updated_at: number
}

interface SupabaseEventRow {
  id: string
  trip_id: string
  day_number: number
  title: string
  start_time: string
  end_time: string
  category: string
  location_name: string
  lat: number | null
  lng: number | null
  notes: string
  estimated_cost: number
  completed: boolean
  created_at: number
}

export function tripToRow(trip: Trip): SupabaseTripRow {
  return {
    id: String(trip.id),
    title: trip.title,
    description: trip.description ?? '',
    start_date: trip.startDate ?? '',
    end_date: trip.endDate ?? '',
    days_count: trip.daysCount ?? 1,
    created_at: trip.createdAt ?? Date.now(),
    updated_at: trip.updatedAt ?? Date.now(),
  }
}

export function rowToTrip(row: SupabaseTripRow): Trip {
  return {
    id: String(row.id),
    title: row.title || 'Rundown Baru',
    description: row.description || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    daysCount: Number(row.days_count) || 1,
    createdAt: Number(row.created_at) || Date.now(),
    updatedAt: Number(row.updated_at) || Date.now(),
  }
}

export function eventToRow(ev: TimelineEvent): SupabaseEventRow {
  return {
    id: String(ev.id),
    trip_id: String(ev.tripId),
    day_number: ev.dayNumber ?? 1,
    title: ev.title,
    start_time: ev.startTime,
    end_time: ev.endTime ?? '',
    category: ev.category ?? 'wisata',
    location_name: ev.locationName ?? '',
    lat: ev.lat ?? null,
    lng: ev.lng ?? null,
    notes: ev.notes ?? '',
    estimated_cost: Number(ev.estimatedCost) || 0,
    completed: Boolean(ev.completed),
    created_at: ev.createdAt ?? Date.now(),
  }
}

export function rowToEvent(row: SupabaseEventRow): TimelineEvent {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    dayNumber: Number(row.day_number) || 1,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time || '',
    category: (row.category as TimelineEvent['category']) || 'wisata',
    locationName: row.location_name || '',
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : null,
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : null,
    notes: row.notes || '',
    estimatedCost: Number(row.estimated_cost) || 0,
    completed: Boolean(row.completed),
    createdAt: Number(row.created_at) || Date.now(),
  }
}

// ── Cloud Sync Operations ────────────────────────────────────────────────────

export async function testSupabaseConnection(): Promise<{
  ok: boolean
  message: string
}> {
  const client = getSupabaseClient()
  if (!client) {
    return { ok: false, message: 'URL atau Anon Key Supabase belum diatur.' }
  }
  try {
    const { error } = await client.from('trips').select('id').limit(1)
    if (error) {
      return {
        ok: false,
        message: `Gagal akses tabel: ${error.message}. Pastikan Anda sudah menjalankan file supabase/schema.sql di SQL Editor Supabase.`,
      }
    }
    return { ok: true, message: 'Terhubung ke Supabase dengan sukses!' }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Koneksi gagal.',
    }
  }
}

export async function pushTripCloud(trip: Trip): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    await client.from('trips').upsert(tripToRow(trip), { onConflict: 'id' })
  } catch {
    // Tetap aman di lokal jika offline
  }
}

export async function deleteTripCloud(id: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    await client.from('events').delete().eq('trip_id', String(id))
    await client.from('trips').delete().eq('id', String(id))
  } catch {
    // Tetap aman di lokal jika offline
  }
}

export async function pushEventCloud(ev: TimelineEvent): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    await client.from('events').upsert(eventToRow(ev), { onConflict: 'id' })
  } catch {
    // Tetap aman di lokal jika offline
  }
}

export async function deleteEventCloud(id: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  try {
    await client.from('events').delete().eq('id', String(id))
  } catch {
    // Tetap aman di lokal jika offline
  }
}
