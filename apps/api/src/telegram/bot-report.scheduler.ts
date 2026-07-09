import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const BOT_REPORT_QUEUE = 'bot-daily-report';

@Injectable()
export class BotReportScheduler implements OnModuleInit {
  constructor(@InjectQueue(BOT_REPORT_QUEUE) private queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      'daily-report',
      { trigger: 'scheduled' },
      {
        repeat: { pattern: '0 7 * * *' },
        jobId: 'bot-daily-report-7am',
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    );
  }
}
