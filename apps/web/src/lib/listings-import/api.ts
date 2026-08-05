'use client';

import { authenticatedFetch } from '../api-client';
import type { BackendImportAnalysisResponse, BackendImportConfirmResponse, BackendImportPreviewResponse, BackendImportMappingItem } from './backend-types';

export class ListingImportApiError extends Error {
  constructor(message: string, readonly status: number, readonly details?: unknown) {
    super(message);
    this.name = 'ListingImportApiError';
  }
}

export async function analyzeListingImport(file: File): Promise<BackendImportAnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return requestJson<BackendImportAnalysisResponse>('listings/import/analyze', { method: 'POST', body: formData });
}

export async function previewListingImport(file: File): Promise<BackendImportPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return requestJson<BackendImportPreviewResponse>('listings/import/preview', { method: 'POST', body: formData });
}

export async function transformListingImport(analysisToken: string, mapping: BackendImportMappingItem[]): Promise<BackendImportPreviewResponse> {
  return requestJson<BackendImportPreviewResponse>('listings/import/transform', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysisToken, mapping }),
  });
}

export async function confirmListingImport(previewToken: string): Promise<BackendImportConfirmResponse> {
  return requestJson<BackendImportConfirmResponse>('listings/import/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ previewToken }),
  });
}

export async function downloadListingImportTemplate(): Promise<void> {
  const response = await authenticatedFetch('listings/import/template');
  if (!response.ok) throw await toApiError(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tiklayayinla-listing-import-template.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, init);
  if (!response.ok) throw await toApiError(response);
  return response.json() as Promise<T>;
}

async function toApiError(response: Response): Promise<ListingImportApiError> {
  const body = await safeBody(response);
  return new ListingImportApiError(messageFor(response.status, body), response.status, body);
}

async function safeBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function messageFor(status: number, body: unknown) {
  const bodyMessage = extractMessage(body);
  if (bodyMessage) return bodyMessage;
  if (status === 400) return 'İçe aktarma isteği geçersiz.';
  if (status === 401) return 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.';
  if (status === 403) return 'Bu işlem için yetkiniz yok.';
  if (status === 413) return 'Dosya boyutu çok büyük.';
  if (status === 422) return 'Backend doğrulaması bazı satırları reddetti.';
  if (status >= 500) return 'Sunucu içe aktarma işlemini tamamlayamadı.';
  return 'İçe aktarma isteği tamamlanamadı.';
}

function extractMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join(' ');
  return typeof message === 'string' ? message : '';
}
