import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ListingImportConfirmDto, ListingImportConfirmResponseDto, ListingImportPreviewResponseDto } from './dto/listing-import.dto';
import { ListingImportService } from './listing-import.service';
import { ListingImportMappingService } from './mapping/listing-import-mapping.service';
import { ImportAnalysisResponseDto } from './mapping/dto/analyze-import.dto';
import { TransformImportDto } from './mapping/dto/transform-import.dto';

const upload = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const fileBody = { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary', description: 'CSV veya JSON kaynak dosyası (.csv, .json)' } }, required: ['file'] } };

@ApiTags('Listing Import')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Access token geçersiz veya eksik.' })
@UseGuards(JwtAccessGuard)
@Controller('listings/import')
export class ListingImportController {
  constructor(private readonly imports: ListingImportService, private readonly mapping: ListingImportMappingService) {}

  @Get('template')
  @ApiOperation({ summary: 'UTF-8 BOM ve ; ayırıcılı CSV ilan şablonunu indirir' })
  template(@Res() response: Response): void { response.type('text/csv; charset=utf-8').attachment('tiklayayinla-listing-import-template.csv').send(this.imports.template()); }

  @Post('preview')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(upload)
  @ApiConsumes('multipart/form-data') @ApiBody(fileBody)
  @ApiOperation({ summary: 'Standart CSV dosyasını kaydetmeden parse eder ve doğrular' })
  @ApiOkResponse({ type: ListingImportPreviewResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Import işlemleri için bir dakika içinde en fazla 20 istek gönderilebilir.' })
  preview(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) { return this.imports.preview(user.id, file); }

  @Post('analyze')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(upload)
  @ApiConsumes('multipart/form-data') @ApiBody(fileBody)
  @ApiOperation({ summary: 'Kaynak CSV kolonlarını analiz eder ve mapping önerileri üretir' })
  @ApiOkResponse({ type: ImportAnalysisResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Import işlemleri için bir dakika içinde en fazla 20 istek gönderilebilir.' })
  analyze(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) { return this.mapping.analyze(user.id, file); }

  @Post('transform')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Onaylı kaynak CSV mappingini standart preview sonucuna dönüştürür' })
  @ApiOkResponse({ type: ListingImportPreviewResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Import işlemleri için bir dakika içinde en fazla 20 istek gönderilebilir.' })
  transform(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransformImportDto) { return this.mapping.transform(user.id, dto); }

  @Post('confirm')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Onaylanmış preview satırlarını toplu olarak ilanlara dönüştürür' })
  @ApiOkResponse({ type: ListingImportConfirmResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Import işlemleri için bir dakika içinde en fazla 20 istek gönderilebilir.' })
  confirm(@CurrentUser() user: AuthenticatedUser, @Body() dto: ListingImportConfirmDto) { return this.imports.confirm(user.id, dto.previewToken); }
}
