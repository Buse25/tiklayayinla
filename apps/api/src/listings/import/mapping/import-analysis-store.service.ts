import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { SourceRow } from './source-dataset';

type Analysis = { userId: string; expiresAt: number; fields: string[]; rows: SourceRow[] };
@Injectable()
export class ImportAnalysisStoreService {
  private readonly analyses = new Map<string, Analysis>();
  create(userId: string, fields: string[], rows: SourceRow[]): string { this.clear(); const token = randomUUID(); this.analyses.set(token, { userId, fields, rows, expiresAt: Date.now() + 15 * 60_000 }); return token; }
  get(userId: string, token: string): Analysis { this.clear(); const analysis = this.analyses.get(token); if (!analysis) throw new BadRequestException('Analysis token geçersiz veya süresi dolmuş.'); if (analysis.userId !== userId) throw new UnauthorizedException('Bu analysis token başka kullanıcıya ait.'); return analysis; }
  private clear(): void { const now = Date.now(); for (const [token, analysis] of this.analyses) if (analysis.expiresAt <= now) this.analyses.delete(token); }
}
