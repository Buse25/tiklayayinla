import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthResponse, HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Uygulama process durumunu kontrol eder' })
  @ApiOkResponse({ description: 'Uygulama processi çalışıyor.' })
  live(): HealthResponse {
    return this.health.live();
  }

  @Get('ready')
  @ApiOperation({ summary: 'PostgreSQL ve RabbitMQ bağımlılıklarının hazır oluşunu kontrol eder' })
  @ApiOkResponse({ description: 'Tüm bağımlılıklar hazır.' })
  @ApiServiceUnavailableResponse({ description: 'PostgreSQL veya RabbitMQ hazır değil.' })
  async ready(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const result = await this.health.ready();
    if (result.status === 'error') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
