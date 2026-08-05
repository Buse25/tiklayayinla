import { useState, type DragEvent } from 'react';
import { downloadListingImportTemplate } from '../../../lib/listings-import/api';
import { maxImportFileSizeBytes, type ParsedImportFile } from '../../../lib/listings-import/types';

type Props = {
  parsed: ParsedImportFile | null;
  error: string;
  reading: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
};

export function FileUploadStep({ parsed, error, reading, onFile, onRemove }: Props) {
  const [templateError, setTemplateError] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  async function downloadTemplate() {
    setTemplateError('');
    setDownloadingTemplate(true);
    try {
      await downloadListingImportTemplate();
    } catch (e) {
      setTemplateError(e instanceof Error ? e.message : 'Şablon indirilemedi.');
    } finally {
      setDownloadingTemplate(false);
    }
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold">Dosya Yükleme</h2>
    <p className="mt-2 text-sm text-slate-600">CSV veya XLSX dosyanızı sürükleyip bırakın ya da seçin. Maksimum dosya boyutu {Math.round(maxImportFileSizeBytes / 1024 / 1024)} MB.</p>
    {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <label className="mt-5 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-teal-500 hover:bg-teal-50" htmlFor="listing-import-file" onDragOver={(event) => event.preventDefault()} onDrop={drop}>
      <span className="material-symbols-rounded text-5xl text-slate-400">upload_file</span>
      <span className="mt-3 font-semibold">{reading ? 'Dosya okunuyor...' : parsed ? parsed.fileName : 'CSV/XLSX dosyası seçin'}</span>
      <span className="mt-1 text-sm text-slate-600">Kabul edilen uzantılar: .csv, .xlsx</span>
      <input accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={reading} id="listing-import-file" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ''; }} type="file" />
    </label>
    {parsed ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 text-sm"><p><strong>{parsed.headers.length}</strong> kolon, <strong>{parsed.rows.length}</strong> satır algılandı.</p><button className="font-semibold text-red-700 hover:underline" onClick={onRemove} type="button">Dosyayı kaldır</button></div> : <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Henüz dosya seçilmedi. Boş satırlar parse sırasında yok sayılır.</div>}
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">CSV şablonu</p>
          <p className="mt-1 text-slate-600">Backend’in desteklediği gerçek CSV şablonunu indirebilirsiniz.</p>
        </div>
        <button className="rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-white disabled:opacity-50" disabled={downloadingTemplate} onClick={downloadTemplate} type="button">{downloadingTemplate ? 'İndiriliyor...' : 'Şablonu İndir'}</button>
      </div>
      {templateError && <p className="mt-3 text-red-700">{templateError}</p>}
    </div>
  </section>;
}
