import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MailService } from './mail.service';

class MailTestDto {
  @IsEmail()
  to!: string;
}

@ApiTags('Mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('test')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Geliştirme ortamında test e-postası gönderir' })
  @ApiBody({ type: MailTestDto })
  @ApiOkResponse({ description: 'Test e-postası gönderildi.' })
  @ApiForbiddenResponse({ description: 'Bu işlem sadece admin kullanıcılar ve production dışı ortam için kullanılabilir.' })
  async test(@CurrentUser() user: AuthenticatedUser, @Body() dto: MailTestDto): Promise<{ success: true; message: string }> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Bu işlem production ortamında kullanılamaz.');
    }
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Bu işlem için admin yetkisi gerekir.');
    }
    await this.mailService.verifyTransport();
    await this.mailService.sendTestMail(dto.to);
    return { success: true, message: 'Test e-postası gönderildi.' };
  }
}

