import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/auth.decorator';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'cleartg-api',
      timestamp: new Date().toISOString(),
      telegramBot: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
      polling: process.env.TELEGRAM_USE_POLLING === 'true',
    };
  }
}
