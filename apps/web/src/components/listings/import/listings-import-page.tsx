'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createInitialMapping, duplicatedSources } from '../../../lib/listings-import/normalizer';
import { parseImportFile } from '../../../lib/listings-import/parser';
import { maxImportFileSizeBytes, type ColumnMapping, type ImportStep, type ParsedImportFile } from '../../../lib/listings-import/types';
import { missingRequiredMappings, validateImport } from '../../../lib/listings-import/validator';
import { ColumnMappingStep } from './column-mapping-step';
import { FileUploadStep } from './file-upload-step';
import { ImportSummaryStep } from './import-summary-step';
import { ValidationPreviewStep } from './validation-preview-step';

const steps = ['Dosya Yükleme', 'Kolon Eşleştirme', 'Doğrulama ve Ön İzleme', 'İçe Aktarma Özeti'];

export function ListingsImportPage() {
  const [step, setStep] = useState<ImportStep>(0);
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const validation = useMemo(() => parsed ? validateImport(parsed, mapping) : null, [mapping, parsed]);

  async function chooseFile(file: File) {
    setError('');
    if (!/\.(csv|xlsx)$/i.test(file.name)) { setError('Sadece .csv ve .xlsx dosyaları desteklenir.'); return; }
    if (file.size > maxImportFileSizeBytes) { setError(`Dosya en fazla ${Math.round(maxImportFileSizeBytes / 1024 / 1024)} MB olabilir.`); return; }
    setReading(true);
    try {
      const value = await parseImportFile(file);
      if (!value.headers.length) { setError('Dosyada okunabilir başlık satırı bulunamadı.'); return; }
      setParsed(value);
      setMapping(createInitialMapping(value.headers));
      setStep(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dosya okunamadı.');
    } finally {
      setReading(false);
    }
  }

  function reset() {
    setStep(0);
    setParsed(null);
    setMapping({});
    setError('');
    setOnlyErrors(false);
  }

  function next() {
    setError('');
    if (step === 0 && !parsed) { setError('Devam etmek için önce bir CSV veya XLSX dosyası seçin.'); return; }
    if (step === 1) {
      const missing = missingRequiredMappings(mapping);
      const duplicates = duplicatedSources(mapping);
      if (missing.length || duplicates.length) { setError('Zorunlu alanları ve tekrar eden kolon eşleştirmelerini kontrol edin.'); return; }
    }
    if (step === 2 && validation?.summary.payloadRows === 0) { setError('İçe aktarılabilecek geçerli satır bulunmuyor.'); return; }
    setStep((current) => Math.min(current + 1, 3) as ImportStep);
  }

  function back() {
    setError('');
    setStep((current) => Math.max(current - 1, 0) as ImportStep);
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
    <div className="mx-auto max-w-6xl">
      <Link className="text-sm font-semibold text-teal-700 hover:underline" href="/listings">← İlanlara dön</Link>
      <header className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-700">TOPLU İŞLEM</p>
        <h1 className="mt-1 text-3xl font-bold">Toplu İlan İçe Aktar</h1>
        <p className="mt-2 text-sm text-slate-600">CSV veya XLSX dosyasını okuyup kolon eşleştirme, doğrulama ve normalize payload ön izlemesi hazırlayın.</p>
      </header>
      <ol className="mt-6 grid gap-2 md:grid-cols-4">{steps.map((label, index) => <li className={`rounded-xl px-3 py-3 text-center text-sm font-semibold ${index === step ? 'bg-teal-700 text-white' : index < step ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'}`} key={label}>{index + 1}. {label}</li>)}</ol>
      {error && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-6">
        {step === 0 && <FileUploadStep error={error} onFile={chooseFile} onRemove={reset} parsed={parsed} reading={reading} />}
        {step === 1 && parsed && <ColumnMappingStep mapping={mapping} onChange={(field, header) => setMapping((current) => ({ ...current, [field]: header }))} parsed={parsed} />}
        {step === 2 && validation && <ValidationPreviewStep onlyErrors={onlyErrors} onToggleOnlyErrors={() => setOnlyErrors((current) => !current)} rows={validation.rows} summary={validation.summary} />}
        {step === 3 && validation && <ImportSummaryStep mapping={mapping} onBack={back} onReset={reset} payloads={validation.payloads} rows={validation.rows} summary={validation.summary} />}
      </div>
      {step < 3 && <footer className="mt-6 flex items-center justify-between">
        <button className="rounded-lg px-4 py-3 font-semibold text-slate-700 disabled:opacity-40" disabled={step === 0 || reading} onClick={back} type="button">Geri</button>
        <button className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50" disabled={reading || (step === 0 && !parsed)} onClick={next} type="button">Devam et</button>
      </footer>}
    </div>
  </main>;
}
