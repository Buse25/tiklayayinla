export interface StorageUploadInput {
  storageKey: string;
  buffer: Buffer;
  contentType: string;
}

export interface StorageService {
  upload(input: StorageUploadInput): Promise<void>;
  delete(storageKey: string): Promise<void>;
  getPublicUrl(storageKey: string): string;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
