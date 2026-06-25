import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { Public } from '../common/decorators/auth.decorator';

@Public()
@Controller('telegram')
export class TelegramController {
  constructor(private telegram: TelegramService) {}

  @Post('webhook')
  async webhook(
    @Req() req: { body: unknown; headers: Record<string, string | string[] | undefined> },
    @Res() res: { status: (code: number) => { send: () => void } },
  ) {
    const handler = this.telegram.getWebhookHandler();
    if (!handler) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).send();
      return;
    }
    return handler(req, res as never);
  }
}
