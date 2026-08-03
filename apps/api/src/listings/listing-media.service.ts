import { Inject, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ListingMedia, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListingMediaResponseDto } from './dto/listing-media-response.dto';

const MAX_IMAGES_PER_LISTING = 30;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class ListingMediaService {
  private readonly logger = new Logger(ListingMediaService.name);
  constructor(private readonly prisma: PrismaService, @Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  async upload(ownerId: string, listingId: string, files: Express.Multer.File[]): Promise<ListingMediaResponseDto[]> {
    await this.ensureOwned(ownerId, listingId);
    if (!files.length) throw new UnprocessableEntityException('En az bir görsel yüklenmelidir.');
    if (files.some(file => !SUPPORTED_MIME_TYPES.has(file.mimetype))) throw new UnprocessableEntityException('Yalnızca JPEG, PNG ve WebP görseller yüklenebilir.');
    if (files.some(file => file.size > MAX_FILE_SIZE)) throw new UnprocessableEntityException('Her görsel en fazla 10 MB olabilir.');
    const currentCount = await this.prisma.listingMedia.count({ where: { listingId } });
    if (currentCount + files.length > MAX_IMAGES_PER_LISTING) throw new UnprocessableEntityException('Bir ilan için en fazla 30 görsel yüklenebilir.');

    const uploads = await Promise.all(files.map(file => this.prepareUpload(listingId, file)));
    try {
      for (const upload of uploads) await this.storage.upload(upload);
      const created = await this.prisma.$transaction(async tx => {
        const latest = await tx.listingMedia.aggregate({ where: { listingId }, _max: { sortOrder: true } });
        const mediaCount = await tx.listingMedia.count({ where: { listingId } });
        if (mediaCount + uploads.length > MAX_IMAGES_PER_LISTING) throw new UnprocessableEntityException('Bir ilan için en fazla 30 görsel yüklenebilir.');
        const baseOrder = latest._max.sortOrder ?? -1;
        return Promise.all(uploads.map((upload, index) => tx.listingMedia.create({ data: { listingId, type: 'IMAGE', url: this.storage.getPublicUrl(upload.storageKey), storageKey: upload.storageKey, originalName: upload.originalName, mimeType: 'image/webp', fileSize: upload.buffer.length, width: upload.width, height: upload.height, sortOrder: baseOrder + index + 1, isCover: mediaCount === 0 && index === 0 } })));
      });
      return created.map(toMediaResponse);
    } catch (error) {
      await Promise.allSettled(uploads.map(upload => this.storage.delete(upload.storageKey)));
      throw error;
    }
  }

  async findAll(ownerId: string, listingId: string): Promise<ListingMediaResponseDto[]> {
    await this.ensureOwned(ownerId, listingId);
    return (await this.prisma.listingMedia.findMany({ where: { listingId }, orderBy: { sortOrder: 'asc' } })).map(toMediaResponse);
  }

  async reorder(ownerId: string, listingId: string, mediaIds: string[]): Promise<ListingMediaResponseDto[]> {
    await this.ensureOwned(ownerId, listingId);
    const media = await this.prisma.listingMedia.findMany({ where: { listingId }, select: { id: true } });
    if (media.length !== mediaIds.length || mediaIds.some(id => !media.some(item => item.id === id))) throw new UnprocessableEntityException('mediaIds ilandaki tüm ve yalnızca bu ilanın görsellerini içermelidir.');
    await this.prisma.$transaction(mediaIds.map((id, index) => this.prisma.listingMedia.update({ where: { id }, data: { sortOrder: index } })));
    return this.findAll(ownerId, listingId);
  }

  async setCover(ownerId: string, listingId: string, mediaId: string): Promise<ListingMediaResponseDto> {
    await this.ensureOwned(ownerId, listingId);
    const media = await this.getOwnedMedia(listingId, mediaId);
    const updated = await this.prisma.$transaction(async tx => { await tx.listingMedia.updateMany({ where: { listingId }, data: { isCover: false } }); return tx.listingMedia.update({ where: { id: media.id }, data: { isCover: true } }); });
    return toMediaResponse(updated);
  }

  async remove(ownerId: string, listingId: string, mediaId: string): Promise<void> {
    await this.ensureOwned(ownerId, listingId);
    const media = await this.getOwnedMedia(listingId, mediaId);
    await this.prisma.$transaction(async tx => {
      await tx.listingMedia.delete({ where: { id: media.id } });
      if (media.isCover) {
        const next = await tx.listingMedia.findFirst({ where: { listingId }, orderBy: { sortOrder: 'asc' } });
        if (next) await tx.listingMedia.update({ where: { id: next.id }, data: { isCover: true } });
      }
    });
    try { await this.storage.delete(media.storageKey); }
    catch (error) { this.logger.error(`Could not remove orphaned media file ${media.storageKey}`, error); }
  }

  private async ensureOwned(ownerId: string, listingId: string): Promise<void> { const listing = await this.prisma.listing.findFirst({ where: { id: listingId, ownerId }, select: { id: true } }); if (!listing) throw new NotFoundException('İlan bulunamadı.'); }
  private async getOwnedMedia(listingId: string, mediaId: string): Promise<ListingMedia> { const media = await this.prisma.listingMedia.findFirst({ where: { id: mediaId, listingId } }); if (!media) throw new NotFoundException('Görsel bulunamadı.'); return media; }
  private async prepareUpload(listingId: string, file: Express.Multer.File) {
    let transformed: { data: Buffer; info: sharp.OutputInfo };
    try { transformed = await sharp(file.buffer, { failOn: 'error' }).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true }); }
    catch { throw new UnprocessableEntityException('Geçerli bir görsel dosyası yükleyin.'); }
    const storageKey = `listings/${listingId}/${randomUUID()}.webp`;
    return { storageKey, buffer: transformed.data, contentType: 'image/webp', originalName: file.originalname, width: transformed.info.width, height: transformed.info.height };
  }
}

function toMediaResponse(media: ListingMedia): ListingMediaResponseDto { return media; }
