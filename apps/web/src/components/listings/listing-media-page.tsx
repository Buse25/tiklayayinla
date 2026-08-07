'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, useEffect, useState } from 'react';
import { authenticatedFetch } from '../../lib/api-client';
import { AppShell } from '../layout/app-shell';

type Media = { id: string; url: string; originalName?: string | null; isCover: boolean };

export function ListingMediaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [media, setMedia] = useState<Media[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMedia() {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const response = await authenticatedFetch(`listings/${id}/media`);
      if (!response.ok) {
        if (response.status !== 401) setError(response.status === 404 ? 'İlan bulunamadı.' : 'Fotoğraflar alınamadı.');
        return;
      }
      setMedia(await response.json() as Media[]);
    } catch { setError('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadMedia(); }, [id]);

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('Yalnızca JPEG, PNG veya WebP görseller seçebilirsiniz.'); return; }
    if (selected.some((file) => file.size > 10 * 1024 * 1024)) { setError('Her görsel en fazla 10 MB olabilir.'); return; }
    if (media.length + selected.length > 30) { setError('Bir ilanda en fazla 30 görsel olabilir.'); return; }
    setError(null); setFiles(selected);
  }

  async function upload() {
    if (!id || files.length === 0 || uploading) return;
    setUploading(true); setError(null);
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    try {
      const response = await authenticatedFetch(`listings/${id}/media`, { method: 'POST', body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
        setError(message || (response.status === 422 ? 'Görseller yüklenemedi.' : 'Yükleme tamamlanamadı.'));
        return;
      }
      setFiles([]);
      await loadMedia();
    } catch { setError('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.'); }
    finally { setUploading(false); }
  }

  return <AppShell><div className="p-md max-w-[1600px] mx-auto text-slate-900"><Link className="text-sm font-semibold text-teal-700 hover:underline" href={`/listings/${id}`}>← İlan detayına dön</Link><header className="mt-4 rounded-2xl border border-slate-200 bg-white p-6"><h1 className="text-3xl font-bold">İlan fotoğrafları</h1><p className="mt-2 text-sm text-slate-600">JPEG, PNG veya WebP biçiminde, görsel başına en fazla 10 MB; ilan başına en fazla 30 görsel yükleyebilirsiniz.</p></header>{error && <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</section>}<section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><label className="block text-sm font-semibold" htmlFor="media-files">Fotoğraf seç</label><input accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-sm" id="media-files" multiple onChange={selectFiles} type="file" />{files.length > 0 && <p className="mt-3 text-sm text-slate-600">{files.length} görsel yüklemeye hazır.</p>}<div className="mt-5 flex flex-wrap gap-3"><button className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={files.length === 0 || uploading} onClick={() => void upload()} type="button">{uploading ? 'Fotoğraflar yükleniyor...' : 'Fotoğrafları yükle'}</button><button className="rounded-xl border border-slate-300 px-5 py-3 font-semibold" disabled={uploading} onClick={() => router.push(`/listings/${id}`)} type="button">İlan detayına git</button></div></section><section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Yüklenen fotoğraflar</h2>{loading ? <div className="mt-4 h-40 animate-pulse rounded-xl bg-slate-200" /> : media.length === 0 ? <p className="mt-3 text-sm text-slate-600">Henüz fotoğraf yüklenmedi.</p> : <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{media.map((item) => <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100" key={item.id}><img alt={item.originalName || 'İlan görseli'} className="h-full w-full object-cover" src={item.url} />{item.isCover && <span className="absolute left-2 top-2 rounded bg-slate-900/80 px-2 py-1 text-xs font-semibold text-white">Kapak</span>}</div>)}</div>}</section></div></AppShell>;
}
