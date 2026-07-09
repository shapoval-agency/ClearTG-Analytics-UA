import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BotAdminService } from './bot-admin.service';
import { TelegramService } from './telegram.service';
import { BOT_REPORT_QUEUE } from './bot-report.scheduler';

@Processor(BOT_REPORT_QUEUE)
export class BotReportProcessor extends WorkerHost {
  constructor(
    private botAdmin: BotAdminService,
    private telegram: TelegramService,
  ) {
    super();
  }

  async process(_job: Job) {
    const bot = this.telegram.getBot();
    if (!bot) return;
    await this.botAdmin.sendDailyReportsToAll(bot);
  }
}
