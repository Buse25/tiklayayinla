'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';
import { AppShell } from '../layout/app-shell';
import {
  buildAuditQueryParams,
  getAuditEntityLabel,
  getAuditEntityLink,
  summarizeAuditChanges,
  translateAuditAction,
  type AuditEntityType,
  type AuditLogFilters,
  type AuditLogsPage,
} from '../../lib/audit-logs';
import { formatListingActivityChanges } from '../../lib/listing-display-labels';



const entityOptions: Array<{ value: '' | AuditEntityType; label: string }> = [
  { value: '', label: 'Tümü' },
  { value: 'LISTING', label: 'İlan' },
  { value: 'PORTAL_ACCOUNT', label: 'Portal hesabı' },
  { value: 'USER', label: 'Kullanıcı' },
  { value: 'IMPORT_BATCH', label: 'Toplu aktarım' },
  { value: 'ORGANIZATION', label: 'Kurumsal başvuru' },
];

export function ActivityPage() {

  const [logs, setLogs] = useState<AuditLogsPage>({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, limit: 20, sortOrder: 'desc' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const logsResponse = await authenticatedFetch(`audit-logs?${buildAuditQueryParams(filters).toString()}`);
      if (!logsResponse.ok) throw new Error(await readMessage(logsResponse, 'Aktivite kayıtları alınamadı.'));
      setLogs(await logsResponse.json() as AuditLogsPage);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Aktivite kayıtları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => logs.data.map((item) => ({
    ...item,
    summary: item.entityType === 'LISTING' ? formatListingActivityChanges(item.changes) : summarizeAuditChanges(item.changes),
    link: getAuditEntityLink(item.entityType, item.entityId),
  })), [logs.data]);

  function updateFilter<K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value as number : 1 }));
  }

  return (
    <AppShell>
      <div className="p-md max-w-[1600px] mx-auto text-slate-900">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-700">AKTİVİTE</p>
            <h1 className="mt-1 text-3xl font-bold">Audit Kayıtları</h1>
            <p className="mt-2 text-slate-600">Güvenli değişiklik özetleri ve ilgili kayıt bağlantıları.</p>
          </div>
        </header>

        {error && (
          <section className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{error}</p>
            <button className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-semibold hover:bg-red-100" onClick={() => void load()} type="button">Tekrar dene</button>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="grid gap-2 text-sm font-semibold">İşlem tipi<input className="rounded-xl border border-slate-300 p-3 font-normal outline-none focus:border-teal-600" onChange={(event) => updateFilter('action', event.target.value ? event.target.value : undefined)} placeholder="LISTING_CREATED" value={filters.action ?? ''} /></label>
            <label className="grid gap-2 text-sm font-semibold">Varlık tipi<select className="rounded-xl border border-slate-300 p-3 font-normal outline-none focus:border-teal-600" onChange={(event) => updateFilter('entityType', event.target.value ? event.target.value as AuditEntityType : undefined)} value={filters.entityType ?? ''}>{entityOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-semibold">Başlangıç tarihi<input className="rounded-xl border border-slate-300 p-3 font-normal outline-none focus:border-teal-600" onChange={(event) => updateFilter('dateFrom', event.target.value ? `${event.target.value}T00:00:00.000Z` : undefined)} type="date" value={filters.dateFrom?.slice(0, 10) ?? ''} /></label>
            <label className="grid gap-2 text-sm font-semibold">Bitiş tarihi<input className="rounded-xl border border-slate-300 p-3 font-normal outline-none focus:border-teal-600" onChange={(event) => updateFilter('dateTo', event.target.value ? `${event.target.value}T23:59:59.999Z` : undefined)} type="date" value={filters.dateTo?.slice(0, 10) ?? ''} /></label>
            <div className="flex items-end"><button className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setFilters({ page: 1, limit: 20, sortOrder: 'desc' })} type="button">Filtreleri temizle</button></div>
          </div>
        </section>

        {loading ? (
          <section className="mt-6 h-[32rem] animate-pulse rounded-2xl bg-slate-200" />
        ) : (
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tarih / saat</th>
                    <th className="px-4 py-3">İşlem yapan</th>
                    <th className="px-4 py-3">İşlem tipi</th>
                    <th className="px-4 py-3">Varlık tipi</th>
                    <th className="px-4 py-3">İlgili kayıt</th>
                    <th className="px-4 py-3">Güvenli değişiklik özeti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-4">{item.actor ? `${item.actor.firstName} ${item.actor.lastName}` : 'Sistem'}</td>
                      <td className="px-4 py-4 font-semibold">{translateAuditAction(item.action)}</td>
                      <td className="px-4 py-4">{getAuditEntityLabel(item.entityType)}</td>
                      <td className="px-4 py-4">{item.link ? <Link className="font-semibold text-teal-700 hover:underline" href={item.link}>Kaydı aç</Link> : <span className="text-slate-400">Bağlantı yok</span>}</td>
                      <td className="px-4 py-4"><div className="space-y-1 text-xs text-slate-600">{item.summary.length ? item.summary.map((line) => <p key={line}>{line}</p>) : <p>Gizli alan yok.</p>}</div></td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>Kayıt bulunamadı.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">Toplam {logs.pagination.total} kayıt</p>
              <div className="flex items-center gap-2">
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40" disabled={filters.page <= 1} onClick={() => updateFilter('page', Math.max(1, filters.page - 1))} type="button">Önceki</button>
                <span className="text-sm text-slate-600">Sayfa {filters.page} / {logs.pagination.totalPages || 1}</span>
                <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40" disabled={filters.page >= logs.pagination.totalPages || logs.pagination.totalPages === 0} onClick={() => updateFilter('page', filters.page + 1)} type="button">Sonraki</button>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

async function readMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    const message = Array.isArray(payload.message) ? payload.message.join(' ') : payload.message;
    return typeof message === 'string' && message.trim().length ? message : fallback;
  } catch {
    return fallback;
  }
}
