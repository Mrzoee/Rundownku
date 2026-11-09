import { useState } from 'react'
import { Database, Check, Copy, RefreshCw, X, Cloud, HardDrive, AlertCircle } from 'lucide-react'
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabase'
import { syncWithSupabase } from '../db'

const SQL_SCHEMA_SNIPPET = `-- Jalankan di Supabase SQL Editor:
create table if not exists public.trips (
  id text primary key,
  title text not null default 'Rundown Baru',
  description text not null default '',
  start_date text not null default '',
  end_date text not null default '',
  days_count integer not null default 1,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists public.events (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  day_number integer not null default 1,
  title text not null,
  start_time text not null,
  end_time text not null default '',
  category text not null default 'wisata',
  location_name text not null default '',
  lat double precision,
  lng double precision,
  notes text not null default '',
  estimated_cost numeric not null default 0,
  completed boolean not null default false,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

alter table public.trips enable row level security;
alter table public.events enable row level security;

drop policy if exists "Allow public access to trips" on public.trips;
create policy "Allow public access to trips" on public.trips for all using (true) with check (true);

drop policy if exists "Allow public access to events" on public.events;
create policy "Allow public access to events" on public.events for all using (true) with check (true);`

interface SupabaseModalProps {
  onClose: () => void
  onSyncSuccess: () => void
}

export default function SupabaseModal({ onClose, onSyncSuccess }: SupabaseModalProps) {
  const existing = getSupabaseConfig()
  const [url, setUrl] = useState(existing?.url ?? '')
  const [anonKey, setAnonKey] = useState(existing?.anonKey ?? '')
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || !anonKey.trim()) {
      saveSupabaseConfig(null)
      setStatusMsg({
        ok: true,
        text: 'Konfigurasi Supabase dihapus. Aplikasi berjalan dalam Mode Lokal (IndexedDB).',
      })
      onSyncSuccess()
      return
    }

    setIsBusy(true)
    setStatusMsg(null)
    saveSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() })

    const test = await testSupabaseConnection()
    if (!test.ok) {
      setIsBusy(false)
      setStatusMsg({ ok: false, text: test.message })
      return
    }

    const syncRes = await syncWithSupabase()
    setIsBusy(false)
    if (syncRes.error) {
      setStatusMsg({ ok: false, text: syncRes.error })
    } else {
      setStatusMsg({
        ok: true,
        text: `Terhubung & tersinkronisasi (${syncRes.syncedTrips} perjalanan, ${syncRes.syncedEvents} destinasi).`,
      })
      onSyncSuccess()
    }
  }

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SQL_SCHEMA_SNIPPET)
      setCopiedSql(true)
      setTimeout(() => setCopiedSql(false), 2500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-border overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-alt">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-bg text-primary flex items-center justify-center">
              <Database size={18} />
            </div>
            <div>
              <h3 className="font-bold text-text-heading text-base">
                Database Hybrid (IndexedDB + Supabase)
              </h3>
              <p className="text-xs text-text-muted">
                Simpan lokal otomatis & sinkronkan ke cloud Supabase kapan saja
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-heading hover:bg-slate-200/60 transition-colors"
            aria-label="Tutup modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSaveAndTest} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Mode Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-border bg-surface-alt flex items-start gap-2.5">
              <HardDrive size={16} className="text-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-text-heading">Mode Offline Lokal</div>
                <div className="text-[11px] text-text-muted leading-snug mt-0.5">
                  Selalu aktif via IndexedDB browser tanpa perlu setup.
                </div>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-border bg-surface-alt flex items-start gap-2.5">
              <Cloud size={16} className="text-primary shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-text-heading">Mode Cloud Supabase</div>
                <div className="text-[11px] text-text-muted leading-snug mt-0.5">
                  Sinkronisasi otomatis lintas perangkat jika URL & Key diisi.
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: SQL Schema */}
          <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200/80">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-bold text-teal-900">
                Langkah 1: Siapkan Tabel di Supabase (Gratis)
              </span>
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-teal-700 border border-teal-200 hover:bg-teal-100/50 px-2.5 py-1 rounded-lg transition-colors"
              >
                {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                {copiedSql ? 'SQL Tersalin!' : 'Salin SQL Schema'}
              </button>
            </div>
            <p className="text-[11px] text-teal-800 leading-relaxed">
              Buka <strong>SQL Editor</strong> di dashboard Supabase Anda, tempel script dari tombol{' '}
              <strong>Salin SQL Schema</strong> di atas (atau dari file{' '}
              <code className="bg-white/80 px-1 py-0.5 rounded">supabase/schema.sql</code>), lalu klik{' '}
              <strong>Run</strong>.
            </p>
          </div>

          {/* Step 2: Credentials */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-text-heading mb-1">
                Supabase Project URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full px-3.5 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-text-heading focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-heading mb-1">
                Supabase Anon / Public Key
              </label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2.5 bg-surface-alt border border-border rounded-xl text-xs text-text-heading focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
              />
              <p className="text-[11px] text-text-muted mt-1">
                Anda juga bisa menyimpannya di file <code className="font-mono">.env</code> dengan variabel{' '}
                <code className="font-mono">VITE_SUPABASE_URL</code> dan{' '}
                <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>.
              </p>
            </div>
          </div>

          {statusMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                statusMsg.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusMsg.ok ? (
                <Check size={15} className="shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
              )}
              <span className="leading-relaxed">{statusMsg.text}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
            {existing && (
              <button
                type="button"
                onClick={() => {
                  setUrl('')
                  setAnonKey('')
                  saveSupabaseConfig(null)
                  setStatusMsg({
                    ok: true,
                    text: 'Koneksi Supabase diputus. Kembali ke Mode Lokal.',
                  })
                  onSyncSuccess()
                }}
                className="px-3.5 py-2.5 rounded-xl border border-border text-xs font-semibold text-text-muted hover:text-danger hover:border-rose-200 transition-colors"
              >
                Putuskan Cloud
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-text-heading hover:bg-surface-alt transition-colors"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-colors disabled:opacity-60"
            >
              <RefreshCw size={14} className={isBusy ? 'animate-spin' : ''} />
              {isBusy ? 'Menyinkronkan...' : 'Simpan & Sinkronkan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
