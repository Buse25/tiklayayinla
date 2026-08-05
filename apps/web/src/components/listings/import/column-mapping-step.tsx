import { duplicatedSources, importFields } from '../../../lib/listings-import/normalizer';
import { missingRequiredMappings } from '../../../lib/listings-import/validator';
import type { ColumnMapping, ParsedImportFile } from '../../../lib/listings-import/types';

type Props = { parsed: ParsedImportFile; mapping: ColumnMapping; onChange: (field: string, header: string) => void };

export function ColumnMappingStep({ parsed, mapping, onChange }: Props) {
  const duplicates = duplicatedSources(mapping);
  const missing = missingRequiredMappings(mapping);
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold">Kolon Eşleştirme</h2>
    <p className="mt-2 text-sm text-slate-600">Dosya başlıkları otomatik algılandı. Eşleşmeleri kontrol edip gerekirse değiştirin.</p>
    {missing.length > 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Zorunlu alanlar eşleşmeden devam edilemez: {missing.map((key) => importFields.find((field) => field.key === key)?.label ?? key).join(', ')}</p>}
    {duplicates.length > 0 && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Aynı kaynak kolon birden fazla hedefe atanmış: {duplicates.join(', ')}</p>}
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {importFields.map((field) => <label className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold" key={field.key}>
        <span>{field.label}{field.required && <span className="text-red-600"> *</span>} <span className="text-xs font-normal text-slate-500">({field.group})</span></span>
        <select className="rounded-lg border border-slate-300 bg-white p-2 font-normal" onChange={(event) => onChange(field.key, event.target.value)} value={mapping[field.key] ?? ''}>
          <option value="">Kullanılmayacak</option>
          {parsed.headers.map((header) => <option key={header} value={header}>{header}</option>)}
        </select>
      </label>)}
    </div>
  </section>;
}
