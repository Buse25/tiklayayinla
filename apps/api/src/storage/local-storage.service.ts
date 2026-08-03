import { Injectable } from '@nestjs/common';
import { mkdir, rm, writeFile } from 'fs/promises';
import { relative, resolve, sep } from 'path';
import { StorageService, type StorageUploadInput } from './storage.service';

@Injectable()
export class LocalStorageService implements StorageService {
  private readonly root = resolve(process.cwd(), 'uploads');

  async upload({ storageKey, buffer }: StorageUploadInput): Promise<void> {
    const destination = this.resolveKey(storageKey);
    await mkdir(resolve(destination, '..'), { recursive: true });
    await writeFile(destination, buffer, { flag: 'wx' });
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.resolveKey(storageKey), { force: true });
  }

  getPublicUrl(storageKey: string): string {
    const baseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
    return `${baseUrl}/uploads/${storageKey.split(sep).join('/')}`;
  }

  private resolveKey(storageKey: string): string {
    if (!storageKey || storageKey.includes('\0')) throw new Error('Invalid storage key.');
    const destination = resolve(this.root, storageKey);
    const safeRelativePath = relative(this.root, destination);
    if (safeRelativePath.startsWith('..') || resolve(this.root, safeRelativePath) !== destination) throw new Error('Unsafe storage key.');
    return destination;
  }
}
