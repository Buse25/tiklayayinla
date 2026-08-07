export type AuditEntityType = 'LISTING' | 'PORTAL_ACCOUNT' | 'USER' | 'IMPORT_BATCH' | 'ORGANIZATION';

export type AuditLogActor = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type AuditLogItem = {
  id: string;
  actorUserId: string;
  actor: AuditLogActor | null;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AuditLogsPage = {
  data: AuditLogItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type AuditLogFilters = {
  page: number;
  limit: number;
  action?: string;
  entityType?: AuditEntityType;
  dateFrom?: string;
  dateTo?: string;
  sortOrder?: 'asc' | 'desc';
};

const actionLabels: Record<string, string> = {
  LISTING_CREATED: 'İlan oluşturuldu',
  LISTING_UPDATED: 'İlan güncellendi',
  LISTING_ARCHIVED: 'İlan arşivlendi',
  LISTING_PUBLISHED: 'İlan yayınlandı',
  LISTING_REPUBLISHED: 'İlan yeniden yayınlandı',
  LISTING_MEDIA_UPLOADED: 'Görsel yüklendi',
  IMPORT_CONFIRMED: 'Toplu ilan aktarımı tamamlandı',
  ORGANIZATION_APPLICATION_CREATED: 'Kurumsal başvuru oluşturuldu',
  ORGANIZATION_APPLICATION_APPROVED: 'Kurumsal başvuru onaylandı',
  ORGANIZATION_APPLICATION_REJECTED: 'Kurumsal başvuru reddedildi',
};

const entityLabels: Record<AuditEntityType, string> = {
  LISTING: 'İlan',
  PORTAL_ACCOUNT: 'Portal hesabı',
  USER: 'Kullanıcı',
  IMPORT_BATCH: 'Toplu aktarım',
  ORGANIZATION: 'Kurumsal başvuru',
};

const sensitiveKey = /password|token|credential|secret|authorization|api[-_]?key|request|response|storage[-_]?key/i;
const maskedKey = /phone|vkn/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function translateAuditAction(action: string) {
  return actionLabels[action] ?? humanizeToken(action);
}

export function getAuditEntityLabel(entityType: AuditEntityType | string) {
  return entityLabels[entityType as AuditEntityType] ?? humanizeToken(entityType);
}

export function sanitizeAuditChanges(value: unknown): unknown {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditChanges(item));
  if (typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKey.test(key))
      .map(([key, item]) => [key, maskedKey.test(key) ? maskSensitiveValue(item) : sanitizeAuditChanges(item)]),
  );
}

export function summarizeAuditChanges(value: unknown) {
  const sanitized = sanitizeAuditChanges(value);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return [];
  return Object.entries(sanitized)
    .map(([key, item]) => `${humanizeToken(key)}: ${formatAuditValue(item)}`)
    .slice(0, 6);
}

export function getAuditEntityLink(entityType: AuditEntityType | string, entityId: string) {
  if (entityType === 'LISTING' && uuidPattern.test(entityId)) return `/listings/${entityId}`;
  if (entityType === 'ORGANIZATION') return '/organization-applications';
  if (entityType === 'PORTAL_ACCOUNT' && uuidPattern.test(entityId)) return '/portal-accounts';
  if (entityType === 'USER' && uuidPattern.test(entityId)) return '/profile';
  return null;
}

export function buildAuditQueryParams(filters: AuditLogFilters) {
  const params = new URLSearchParams();
  params.set('page', String(filters.page));
  params.set('limit', String(filters.limit));
  if (filters.action) params.set('action', filters.action);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  return params;
}

function humanizeToken(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => formatAuditValue(item)).join(', ');
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${humanizeToken(key)}=${formatAuditValue(item)}`).join(', ');
  return String(value);
}

function maskSensitiveValue(value: unknown) {
  if (typeof value !== 'string') return '••••';
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 4) return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
  return '••••';
}
