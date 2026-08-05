import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { confirmListingImport, previewListingImport, type ListingImportApiError } from '../../../lib/listings-import/api';
import { createBackendImportCsvFile, mapBackendRowToSourceRow, prepareBackendImportRows, type BackendImportPreparedPayload } from '../../../lib/listings-import/backend-adapter';
import type { BackendImportConfirmResponse, BackendImportError, BackendImportPreviewResponse } from '../../../lib/listings-import/backend-types';
import { importFields } from '../../../lib/listings-import/normalizer';
import type { ColumnMapping, ListingImportPayload, ValidatedImportRow, ValidationSummary } from '../../../lib/listings-import/types';

type Props = {
  mapping: ColumnMapping;
  payloads: ListingImportPayload[];
  rows: ValidatedImportRow[];
  summary: ValidationSummary;
  onBack: () => void;
  onReset: () => void;
};

type PreviewState =
  | { status: 'idle' | 'loading'; error?: string }
  | { status: 'ready'; prepared: BackendImportPreparedPayload; preview: BackendImportPreviewResponse }
  | { status: 'error'; error: string; retryable: boolean };

type ConfirmState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: BackendImportConfirmResponse }
  | { status: 'error'; error: string; tokenMayBeConsumed: boolean };

export function ImportSummaryStep({ mapping, payloads, rows, summary, onBack, onReset }: Props) {
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'idle' });
  const [confirmState, setConfirmState] = useState<ConfirmState>({ status: 'idle' });
  const prepared = useMemo(() => prepareBackendImportRows(rows), [rows]);
  const jsonPreview = useMemo(() => JSON.stringify(payloads.slice(0, 5), null, 2), [payloads]);
  const backendJsonPreview = useMemo(() => JSON.stringify(prepared.backendJson.slice(0, 5), null, 2), [prepared]);
  const confirmInProgress = confirmState.status === 'loading';

  useEffect(() => {
    void createPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);

  useEffect(() => {
    if (!confirmInProgress) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [confirmInProgress]);

  async function createPreview() {
    if (!prepared.rows.length) {
      setPreviewState({ status: 'error', error: 'Backend’e gönderilecek geçerli satır bulunmuyor.', retryable: false });
      return;
    }
    setPreviewState({ status: 'loading' });
    setConfirmState({ status: 'idle' });
    try {
      const file = createBackendImportCsvFile(prepared.backendJson);
      const preview = await previewListingImport(file);
      setPreviewState({ status: 'ready', prepared, preview });
    } catch (e) {
      setPreviewState({ status: 'error', error: errorMessage(e), retryable: true });
    }
  }

  async function confirmImport() {
    if (previewState.status !== 'ready' || confirmState.status === 'loading' || confirmState.status === 'done') return;
    setConfirmState({ status: 'loading' });
    try {
      const result = await confirmListingImport(previewState.preview.previewToken);
      setConfirmState({ status: 'done', result });
    } catch (e) {
      const status = typeof e === 'object' && e !== null && 'status' in e ? Number((e as ListingImportApiError).status) : 0;
      setConfirmState({ status: 'error', error: errorMessage(e), tokenMayBeConsumed: status === 400 || status === 404 || status === 422 || status >= 500 });
    }
  }

  if (confirmState.status === 'done' && previewState.status === 'ready') {
    return <ImportResult result={confirmState.result} prepared={previewState.prepared} onReset={onReset} />;
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold">İçe Aktarma Özeti</h2>
    <p className="mt-2 text-sm text-slate-600">Frontend doğrulamasından geçen ilanlar backend’in mevcut CSV preview → confirm akışına gönderiliyor. Backend doğrulaması nihai sonuç kabul edilir.</p>

    {prepared.unsupportedWarnings.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      {prepared.unsupportedWarnings.map((warning) => <p key={warning}>{warning}</p>)}
    </div>}

    <div className="mt-5 grid gap-3 sm:grid-cols-4">
      <Metric label="Frontend hazır" value={summary.payloadRows} />
      <Metric label="Backend kontrol" value={previewState.status === 'ready' ? previewState.preview.summary.totalRows : prepared.rows.length} />
      <Metric label="Backend kabul" value={previewState.status === 'ready' ? previewState.preview.summary.validRows : 0} />
      <Metric label="Backend red" value={previewState.status === 'ready' ? previewState.preview.summary.invalidRows : 0} />
    </div>

    {previewState.status === 'loading' && <p className="mt-5 rounded-xl bg-teal-50 p-4 text-sm font-semibold text-teal-800">Backend doğrulaması hazırlanıyor...</p>}

    {previewState.status === 'error' && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p className="font-semibold">Backend doğrulaması tamamlanamadı.</p>
      <p className="mt-1">{previewState.error}</p>
      {previewState.retryable && <button className="mt-3 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white" onClick={createPreview} type="button">Tekrar Dene</button>}
    </div>}

    {previewState.status === 'ready' && <>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold">İçe aktarılmaya hazır ilanlar</h3>
          {previewState.preview.validRows.length ? <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
            {previewState.preview.validRows.map((row) => <li className="rounded-lg bg-slate-50 p-3" key={row.row}>
              <strong>Satır {mapBackendRowToSourceRow(previewState.prepared, row.row)}</strong> — {row.title} · {row.city}/{row.district} · {row.price} {row.currency}
            </li>)}
          </ul> : <p className="mt-3 text-sm text-slate-600">Backend doğrulamasından geçen satır yok.</p>}
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-bold">Backend tarafından reddedilen satırlar</h3>
          {previewState.preview.errors.length ? <ErrorList errors={previewState.preview.errors} prepared={previewState.prepared} /> : <p className="mt-3 text-sm text-slate-600">Backend reddi yok.</p>}
        </section>
      </div>

      {confirmState.status === 'error' && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="font-semibold">İçe aktarma tamamlanamadı.</p>
        <p className="mt-1">{confirmState.error}</p>
        {confirmState.tokenMayBeConsumed && <p className="mt-2">Bu denemede previewToken backend tarafından tüketilmiş olabilir. Güvenli tekrar deneme için yeniden backend doğrulaması oluşturun.</p>}
        <button className="mt-3 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white" onClick={createPreview} type="button">Backend Doğrulamasını Yenile</button>
      </div>}
    </>}

    <section className="mt-6"><h3 className="font-bold">Kullanılacak eşleştirmeler</h3><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{Object.entries(mapping).filter(([, source]) => source).map(([field, source]) => <div className="rounded-lg bg-slate-50 p-3" key={field}><dt className="font-semibold text-slate-500">{importFields.find((item) => item.key === field)?.label ?? field}</dt><dd>{source}</dd></div>)}</dl></section>

    <details className="mt-6 rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
      <summary className="cursor-pointer font-semibold">Geliştirici JSON ön izlemesi</summary>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap">{jsonPreview}</pre>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap">{backendJsonPreview}</pre>
      </div>
    </details>

    <div className="mt-6 flex flex-wrap gap-3">
      <button className="rounded-xl border border-slate-300 px-5 py-3 font-semibold disabled:opacity-50" disabled={confirmInProgress} onClick={onBack} type="button">Geri Dön ve Düzelt</button>
      <button className="rounded-xl border border-slate-300 px-5 py-3 font-semibold disabled:opacity-50" disabled={confirmInProgress} onClick={onReset} type="button">Baştan Başla</button>
      <button className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50" disabled={previewState.status !== 'ready' || previewState.preview.summary.validRows === 0 || confirmInProgress || confirmState.status === 'done'} onClick={confirmImport} type="button">
        {confirmInProgress ? 'İlanlar içe aktarılıyor...' : 'İlanları İçe Aktar'}
      </button>
    </div>
  </section>;
}

function ImportResult({ result, prepared, onReset }: { result: BackendImportConfirmResponse; prepared: BackendImportPreparedPayload; onReset: () => void }) {
  const failedRowsId = 'failed-import-rows';
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold">İçe Aktarma Sonucu</h2>
    <div className="mt-5 grid gap-3 sm:grid-cols-4">
      <Metric label="Talep edilen" value={result.summary.totalRows} />
      <Metric label="Başarılı" value={result.summary.createdRows} />
      <Metric label="Başarısız" value={result.summary.failedRows} />
      <Metric label="Atlanan" value={result.summary.skippedRows} />
    </div>

    <section className="mt-6 rounded-xl border border-slate-200 p-4">
      <h3 className="font-bold">Oluşturulan ilanlar</h3>
      {result.createdListings.length ? <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {result.createdListings.map((listing) => <li className="rounded-lg bg-slate-50 p-3" key={listing.id}>
          <p><strong>Satır {mapBackendRowToSourceRow(prepared, listing.row)}</strong> — {listing.listingNo}</p>
          <Link className="mt-2 inline-block font-semibold text-teal-700 hover:underline" href={`/listings/${listing.id}`}>İlan detayına git</Link>
        </li>)}
      </ul> : <p className="mt-3 text-sm text-slate-600">Oluşturulan ilan yok.</p>}
    </section>

    <section className="mt-6 rounded-xl border border-slate-200 p-4" id={failedRowsId}>
      <h3 className="font-bold">Başarısız satırlar</h3>
      {result.errors.length ? <ErrorList errors={result.errors} prepared={prepared} /> : <p className="mt-3 text-sm text-slate-600">Başarısız satır yok.</p>}
    </section>

    <div className="mt-6 flex flex-wrap gap-3">
      <Link className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white" href="/listings">İlanlara Git</Link>
      <button className="rounded-xl border border-slate-300 px-5 py-3 font-semibold" onClick={onReset} type="button">Yeni İçe Aktarma Başlat</button>
      {result.errors.length > 0 && <a className="rounded-xl border border-slate-300 px-5 py-3 font-semibold" href={`#${failedRowsId}`}>Hatalı Satırları Gör</a>}
    </div>
  </section>;
}

function ErrorList({ errors, prepared }: { errors: BackendImportError[]; prepared: BackendImportPreparedPayload }) {
  return <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
    {errors.map((error, index) => <li className="rounded-lg bg-red-50 p-3 text-red-800" key={`${error.row}-${error.column}-${error.code}-${index}`}>
      <strong>Satır {mapBackendRowToSourceRow(prepared, error.row)}</strong> · {error.column} · {error.code}
      <p className="mt-1">{error.message}</p>
      {error.value && <p className="mt-1 text-xs opacity-80">Değer: {error.value}</p>}
    </li>)}
  </ul>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-600">{label}</p><strong className="mt-1 block text-2xl">{value}</strong></div>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'İçe aktarma işlemi tamamlanamadı.';
}
