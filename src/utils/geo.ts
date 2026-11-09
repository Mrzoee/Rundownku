import type { EventCategory, TimelineEvent, Trip } from '../types'

export interface CategoryMeta {
  id: EventCategory
  label: string
  bgClass: string
  textClass: string
  borderClass: string
  dotColor: string
}

export const CATEGORY_MAP: Record<EventCategory, CategoryMeta> = {
  wisata: {
    id: 'wisata',
    label: 'Wisata & Spot',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-700',
    borderClass: 'border-teal-200',
    dotColor: '#0d9488',
  },
  kuliner: {
    id: 'kuliner',
    label: 'Kuliner & Kafe',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    dotColor: '#d97706',
  },
  belanja: {
    id: 'belanja',
    label: 'Belanja & Oleh-oleh',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200',
    dotColor: '#e11d48',
  },
  acara: {
    id: 'acara',
    label: 'Acara / Kegiatan',
    bgClass: 'bg-sky-50',
    textClass: 'text-sky-700',
    borderClass: 'border-sky-200',
    dotColor: '#0284c7',
  },
  istirahat: {
    id: 'istirahat',
    label: 'Istirahat / Santai',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    dotColor: '#059669',
  },
  lainnya: {
    id: 'lainnya',
    label: 'Lainnya',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-200',
    dotColor: '#475569',
  },
}

/** Palet warna per Hari (Stippl-style multi-day route colors) */
export const DAY_PALETTE = [
  '#0d9488', // Hari 1: Teal
  '#ea580c', // Hari 2: Warm Orange
  '#2563eb', // Hari 3: Royal Blue
  '#e11d48', // Hari 4: Rose
  '#059669', // Hari 5: Emerald
  '#d97706', // Hari 6: Amber
  '#4f46e5', // Hari 7: Indigo
]

export function getDayColor(dayNumber: number): string {
  const index = Math.max(0, dayNumber - 1) % DAY_PALETTE.length
  return DAY_PALETTE[index]
}

/** Parse tanggal YYYY-MM-DD secara lokal tanpa pergeseran UTC */
export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return null
  return new Date(parts[0], parts[1] - 1, parts[2])
}

export function formatShortDate(dateStr: string): string | null {
  const date = parseLocalDate(dateStr)
  if (!date) return null
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = parseLocalDate(startDate)
  if (!start) return 'Tanggal fleksibel'
  const end = parseLocalDate(endDate)
  if (!end || startDate === endDate) {
    return start.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()
  if (sameMonth) {
    return `${start.getDate()} – ${end.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`
  }
  return `${start.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  })} – ${end.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`
}

/** Hitung jumlah hari inklusif dari startDate ke endDate */
export function getDaysCountBetween(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  if (!start || !end) return 1
  const diffMs = end.getTime() - start.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, Math.min(30, diffDays))
}

/** Dapatkan label tanggal untuk Hari ke-N jika startDate diset */
export function getDayDateLabel(startDate: string, dayNumber: number): string | null {
  const start = parseLocalDate(startDate)
  if (!start) return null
  const target = new Date(start)
  target.setDate(start.getDate() + (dayNumber - 1))
  return target.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Rumus Haversine: hitung jarak lurus (km) antara 2 koordinat */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371 // Radius bumi dalam km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  // Faktor koreksi ~1.25 untuk mendekati jarak tempuh jalan raya rata-rata
  return R * c * 1.25
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.max(50, Math.round(km * 1000))} m`
  }
  return `${km.toFixed(1)} km`
}

/** Estimasi waktu perjalanan darat dalam kota/antar titik */
export function estimateTravelTime(km: number): string {
  if (km < 0.8) {
    const walkMins = Math.max(2, Math.round((km / 4.5) * 60))
    return `~${walkMins} mnt jalan`
  }
  // Kecepatan rata-rata berkendara 30 km/jam di perkotaan / wisata
  const driveMins = Math.max(3, Math.round((km / 30) * 60))
  if (driveMins < 60) return `~${driveMins} mnt`
  const hours = Math.floor(driveMins / 60)
  const remMins = driveMins % 60
  return remMins > 0 ? `~${hours}j ${remMins}m` : `~${hours} jam`
}

/** Buat titik-titik garis lengkung (Bezier) ala Stippl antara 2 koordinat di peta */
export function createCurvedRoutePoints(
  start: [number, number],
  end: [number, number],
  segments = 24
): [number, number][] {
  const [lat1, lng1] = start
  const [lat2, lng2] = end
  const dLat = lat2 - lat1
  const dLng = lng2 - lng1
  const dist = Math.hypot(dLat, dLng)

  if (dist < 0.0005) return [start, end]

  // Titik kontrol tengah digeser tegak lurus sedikit untuk efek lengkungan halus
  const midLat = (lat1 + lat2) / 2
  const midLng = (lng1 + lng2) / 2
  const offsetFactor = 0.16
  const ctrlLat = midLat - dLng * offsetFactor
  const ctrlLng = midLng + dLat * offsetFactor

  const points: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const invT = 1 - t
    const lat = invT * invT * lat1 + 2 * invT * t * ctrlLat + t * t * lat2
    const lng = invT * invT * lng1 + 2 * invT * t * ctrlLng + t * t * lng2
    points.push([lat, lng])
  }
  return points
}

/** Hitung durasi kegiatan dari startTime (HH:mm) dan endTime (HH:mm) */
export function getEventDurationLabel(startTime: string, endTime: string): string | null {
  if (!startTime || !endTime) return null
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if ([sh, sm, eh, em].some(isNaN)) return null
  const diffMins = eh * 60 + em - (sh * 60 + sm)
  if (diffMins <= 0) return null
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  if (hours > 0 && mins > 0) return `${hours}j ${mins}m`
  if (hours > 0) return `${hours} jam`
  return `${mins} mnt`
}

export function isTimeRangeInvalid(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false
  return endTime < startTime
}

export function formatCurrencyIDR(amount: number): string {
  if (!amount || amount <= 0) return ''
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Urutkan events berdasarkan dayNumber lalu startTime */
export function sortEventsChronologically(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber
    return a.startTime.localeCompare(b.startTime)
  })
}

/** Buat format teks siap bagikan ke WhatsApp */
export function formatTripForWhatsApp(trip: Trip, events: TimelineEvent[]): string {
  const sorted = sortEventsChronologically(events)
  const lines: string[] = []
  lines.push(`🗺️ *${trip.title.toUpperCase()}*`)
  if (trip.startDate) {
    lines.push(`📅 ${formatDateRange(trip.startDate, trip.endDate)} (${trip.daysCount} Hari)`)
  } else {
    lines.push(`📅 Durasi: ${trip.daysCount} Hari`)
  }
  if (trip.description) {
    lines.push(`📝 _${trip.description}_`)
  }
  lines.push('')

  for (let day = 1; day <= trip.daysCount; day++) {
    const dayEvents = sorted.filter((ev) => (ev.dayNumber || 1) === day)
    const dayDate = getDayDateLabel(trip.startDate, day)
    lines.push(`*━━ HARI ${day}${dayDate ? ` (${dayDate})` : ''} ━━*`)
    if (dayEvents.length === 0) {
      lines.push('  _(Belum ada destinasi)_')
    } else {
      dayEvents.forEach((ev, idx) => {
        const timeStr = ev.endTime ? `${ev.startTime}–${ev.endTime}` : ev.startTime
        const check = ev.completed ? '✅' : `${idx + 1}.`
        lines.push(`${check} *${timeStr}* — *${ev.title}*`)
        if (ev.locationName) {
          lines.push(`   📍 ${ev.locationName}`)
        }
        if (ev.lat !== null && ev.lng !== null) {
          lines.push(`   🔗 https://www.google.com/maps/search/?api=1&query=${ev.lat},${ev.lng}`)
        }
        if (ev.notes) {
          lines.push(`   💡 _${ev.notes}_`)
        }
        if (ev.estimatedCost > 0) {
          lines.push(`   💰 ${formatCurrencyIDR(ev.estimatedCost)}`)
        }
      })
    }
    lines.push('')
  }

  const totalCost = sorted.reduce((acc, ev) => acc + (ev.estimatedCost || 0), 0)
  if (totalCost > 0) {
    lines.push(`💵 *Total Estimasi Biaya:* ${formatCurrencyIDR(totalCost)}`)
  }
  lines.push('_Dibuat dengan Rundownku_')
  return lines.join('\n')
}

/** Encode & Decode trip untuk fitur Share Link tanpa wajib login */
export function encodeShareableTrip(trip: Trip, events: TimelineEvent[]): string {
  const payload = {
    t: {
      title: trip.title,
      description: trip.description,
      startDate: trip.startDate,
      endDate: trip.endDate,
      daysCount: trip.daysCount,
    },
    e: sortEventsChronologically(events).map((ev) => ({
      d: ev.dayNumber,
      t: ev.title,
      s: ev.startTime,
      e: ev.endTime,
      c: ev.category,
      l: ev.locationName,
      lat: ev.lat,
      lng: ev.lng,
      n: ev.notes,
      cost: ev.estimatedCost,
    })),
  }
  const json = JSON.stringify(payload)
  return btoa(encodeURIComponent(json))
}

export function decodeShareableTrip(encoded: string): {
  trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>
  events: Omit<TimelineEvent, 'id' | 'tripId' | 'createdAt' | 'completed'>[]
} | null {
  try {
    const json = decodeURIComponent(atob(encoded))
    const parsed = JSON.parse(json)
    if (!parsed || !parsed.t || !Array.isArray(parsed.e)) return null
    return {
      trip: {
        title: parsed.t.title || 'Rundown Bersama',
        description: parsed.t.description || '',
        startDate: parsed.t.startDate || '',
        endDate: parsed.t.endDate || '',
        daysCount: Number(parsed.t.daysCount) || 1,
      },
      events: parsed.e.map((item: Record<string, unknown>) => ({
        dayNumber: Number(item.d) || 1,
        title: String(item.t || 'Destinasi'),
        startTime: String(item.s || '09:00'),
        endTime: String(item.e || ''),
        category: (item.c as EventCategory) || 'wisata',
        locationName: String(item.l || ''),
        lat: typeof item.lat === 'number' ? item.lat : null,
        lng: typeof item.lng === 'number' ? item.lng : null,
        notes: String(item.n || ''),
        estimatedCost: Number(item.cost) || 0,
      })),
    }
  } catch {
    return null
  }
}
