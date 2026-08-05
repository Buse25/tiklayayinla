import type { ValidatedImportRow, ValidationSummary } from '../../../lib/listings-import/types';

type Props = { rows: ValidatedImportRow[]; summary: ValidationSummary; onlyErrors: boolean; onToggleOnlyErrors: () => void };
const statusLabel = { VALID: 'Geçerli', WARNING: 'Uyarılı', ERROR: 'Hatalı' };

export function ValidationPreviewStep({ rows, summary, onlyErrors, onToggleOnlyErrors }: Props) {
  const visible = (onlyErrors ? rows.filter((row) => row.status === 'ERROR') : rows).slice(0, 50);
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 className="text-xl font-bold">Doğrulama ve Ön İzleme</h2><p className="mt-2 text-sm text-slate-600">İlk 50 satır gösterilir. Hatalı satırlar payload’a dahil edilmez.</p></div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input checked={onlyErrors} onChange={onToggleOnlyErrors} type="checkbox" />Yalnızca hatalı satırlar</label>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-4">
      <Metric label="Toplam" value={summary.totalRows} />
      <Metric label="Geçerli" value={summary.validRows} />
      <Metric label="Uyarılı" value={summary.warningRows} />
      <Metric label="Hatalı" value={summary.errorRows} />
    </div>
    <div className="mt-5 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead><tr className="text-left text-slate-500"><th className="py-2 pr-4">Satır</th><th className="py-2 pr-4">Durum</th><th className="py-2 pr-4">Başlık</th><th className="py-2 pr-4">Fiyat</th><th className="py-2 pr-4">Konum</th><th className="py-2 pr-4">Mesajlar</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{visible.map((row) => <tr key={row.rowNumber}><td className="py-3 pr-4 font-semibold">{row.rowNumber}</td><td className="py-3 pr-4">{statusLabel[row.status]}</td><td className="py-3 pr-4">{row.payload?.title ?? '—'}</td><td className="py-3 pr-4">{row.payload?.price ?? '—'}</td><td className="py-3 pr-4">{row.payload ? `${row.payload.district}, ${row.payload.city}` : '—'}</td><td className="py-3 pr-4 text-slate-600">{row.issues.length ? row.issues.map((issue) => issue.message).join(' · ') : 'Sorun yok'}</td></tr>)}</tbody>
      </table>
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">{label}</p><strong className="mt-1 block text-2xl">{value}</strong></div>;
}
