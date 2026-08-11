import { useEffect, useMemo, useState } from 'react';
import { importFields } from '../../../lib/listings-import/normalizer';
import { validateImportRow } from '../../../lib/listings-import/validator';
import type { ColumnMapping, ValidatedImportRow, ValidationSummary } from '../../../lib/listings-import/types';

type Props = {
  mapping: ColumnMapping;
  rows: ValidatedImportRow[];
  summary: ValidationSummary;
  onlyErrors: boolean;
  onToggleOnlyErrors: () => void;
  onRowsChange: (rows: ValidatedImportRow[]) => void;
};

const statusLabel = { VALID: 'Geçerli', WARNING: 'Uyarılı', ERROR: 'Hatalı' };

export function ValidationPreviewStep({ mapping, rows, summary, onlyErrors, onToggleOnlyErrors, onRowsChange }: Props) {
  const [editableRows, setEditableRows] = useState(rows);

  useEffect(() => {
    setEditableRows(rows);
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filtered = onlyErrors ? editableRows.filter((row) => row.status === 'ERROR') : editableRows;
    return filtered.slice(0, 50);
  }, [editableRows, onlyErrors]);

  function updateRowField(row: ValidatedImportRow, fieldKey: string, value: string) {
    const sourceKey = mapping[fieldKey];
    if (!sourceKey) return;
    const nextRow = validateImportRow({ rowNumber: row.rowNumber, values: { ...row.source, [sourceKey]: value } }, mapping);
    const nextRows = editableRows.map((current) => (current.rowNumber === row.rowNumber ? nextRow : current));
    setEditableRows(nextRows);
    onRowsChange(nextRows);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Doğrulama ve Ön İzleme</h2>
          <p className="mt-2 text-sm text-slate-600">İlk 50 satır gösterilir. Hatalı satırlar payload’a dahil edilmez.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input checked={onlyErrors} onChange={onToggleOnlyErrors} type="checkbox" />
          Yalnızca hatalı satırlar
        </label>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        Hatalı satırlar içe aktarılmaz. Dosyadaki ilgili hücreleri kabul edilen değerlerden biriyle güncelleyip yeniden
        yükleyebilirsiniz.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Metric label="Toplam" value={summary.totalRows} />
        <Metric label="Geçerli" value={summary.validRows} />
        <Metric label="Uyarılı" value={summary.warningRows} />
        <Metric label="Hatalı" value={summary.errorRows} />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-4">Satır</th>
              <th className="py-2 pr-4">Durum</th>
              <th className="py-2 pr-4">Başlık</th>
              <th className="py-2 pr-4">Fiyat</th>
              <th className="py-2 pr-4">Konum</th>
              <th className="py-2 pr-4">Mesajlar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row) => (
              <tr key={row.rowNumber} className={row.status === 'ERROR' ? 'bg-red-50/40' : ''}>
                <td className="py-3 pr-4 font-semibold">{row.rowNumber}</td>
                <td className="py-3 pr-4">{statusLabel[row.status]}</td>
                <td className="py-3 pr-4 align-top">{renderTextOrEditor(row, 'title', mapping, updateRowField)}</td>
                <td className="py-3 pr-4 align-top">{renderTextOrEditor(row, 'price', mapping, updateRowField)}</td>
                <td className="py-3 pr-4 align-top">
                  <div className="space-y-2">
                    {renderTextOrEditor(row, 'city', mapping, updateRowField)}
                    {renderTextOrEditor(row, 'district', mapping, updateRowField)}
                  </div>
                </td>
                <td className="max-w-[28rem] py-3 pr-4 align-top text-slate-600">
                  <div className="space-y-3 whitespace-normal break-words">
                    {renderIssueList(row, mapping, updateRowField)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderTextOrEditor(
  row: ValidatedImportRow,
  fieldKey: string,
  mapping: ColumnMapping,
  onChange: (row: ValidatedImportRow, fieldKey: string, value: string) => void,
) {
  const field = importFields.find((item) => item.key === fieldKey);
  if (!field) {
    return <span>—</span>;
  }

  const hasError = row.status === 'ERROR' && row.issues.some((issue) => issue.field === fieldKey);
  const value = getFieldValue(row, mapping, fieldKey);

  if (!hasError) {
    return <span>{formatDisplayValue(value)}</span>;
  }

  const messages = row.issues.filter((issue) => issue.field === fieldKey).map((issue) => issue.message);

  return (
    <div className="space-y-1">
      <FieldEditor field={field} value={value} onChange={(nextValue) => onChange(row, fieldKey, nextValue)} />
      {messages.length > 0 && <p className="text-xs text-red-700">{messages.join(' · ')}</p>}
    </div>
  );
}

function renderIssueList(
  row: ValidatedImportRow,
  mapping: ColumnMapping,
  onChange: (row: ValidatedImportRow, fieldKey: string, value: string) => void,
) {
  if (!row.issues.length) {
    return <span>Sorun yok</span>;
  }

  const groupedIssues = new Map<string, string[]>();

  for (const issue of row.issues) {
    if (!issue.field) continue;
    groupedIssues.set(issue.field, [...(groupedIssues.get(issue.field) ?? []), issue.message]);
  }

  const renderedFields = new Set(['title', 'price', 'city', 'district']);
  const hiddenIssues = Array.from(groupedIssues.entries()).filter(([fieldKey]) => !renderedFields.has(fieldKey));

  if (!hiddenIssues.length) {
    return <span>Hatalı alanlar solda düzenlenebilir.</span>;
  }

  return (
    <>
      {hiddenIssues.map(([fieldKey, messages]) => {
        const field = importFields.find((item) => item.key === fieldKey);
        if (!field) {
          return (
            <p key={fieldKey} className="text-red-700">
              {messages.join(' · ')}
            </p>
          );
        }

        return (
          <div key={fieldKey} className="rounded-lg border border-red-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">{field.label}</p>
            <div className="mt-2">
              <FieldEditor field={field} value={getFieldValue(row, mapping, fieldKey)} onChange={(nextValue) => onChange(row, fieldKey, nextValue)} />
            </div>
            <p className="mt-2 text-xs text-red-700">{messages.join(' · ')}</p>
          </div>
        );
      })}
    </>
  );
}

function FieldEditor({ field, value, onChange }: { field: (typeof importFields)[number]; value: string; onChange: (value: string) => void }) {
  const controlClassName = 'w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

  if (field.type === 'enum') {
    return (
      <select className={controlClassName} onChange={(event) => onChange(event.target.value)} value={field.options?.some((option) => option.value === value) ? value : ''}>
        <option value="">Seçin</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'number') {
    return <input className={controlClassName} inputMode="decimal" onChange={(event) => onChange(event.target.value.replace(/[^0-9.,-]/g, '').replace(',', '.'))} type="text" value={value} />;
  }

  return <input className={controlClassName} onChange={(event) => onChange(event.target.value)} type="text" value={value} />;
}

function getFieldValue(row: ValidatedImportRow, mapping: ColumnMapping, fieldKey: string) {
  const sourceKey = mapping[fieldKey];
  return sourceKey ? row.source[sourceKey] ?? '' : '';
}

function formatDisplayValue(value: string) {
  return value || '—';
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <strong className="mt-1 block text-2xl">{value}</strong>
    </div>
  );
}
