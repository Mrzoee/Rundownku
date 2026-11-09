export type EventCategory =
  | 'wisata'
  | 'kuliner'
  | 'belanja'
  | 'acara'
  | 'istirahat'
  | 'lainnya'

export interface Trip {
  id: string
  title: string
  description: string
  startDate: string
  endDate: string
  daysCount: number
  createdAt: number
  updatedAt: number
}

export interface TimelineEvent {
  id: string
  tripId: string
  dayNumber: number
  title: string
  startTime: string
  endTime: string
  category: EventCategory
  locationName: string
  lat: number | null
  lng: number | null
  notes: string
  estimatedCost: number
  completed: boolean
  createdAt: number
}

export type NewTimelineEventInput = Omit<TimelineEvent, 'id' | 'tripId' | 'createdAt'>

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export type SyncStatus = 'local-only' | 'synced' | 'syncing' | 'error'
