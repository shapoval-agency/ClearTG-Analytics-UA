import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const BOT_REPORT_QUEUE = 'bot-daily-report';

@Injectable()
export class BotReportScheduler implements OnModuleInit {
  constructor(@InjectQueue(BOT_REPORT_QUEUE) private queue: Queue) {}

  async onModuleInit() {
    // Старий fixed 07:00 repeatable job може лишитися в Redis після деплою.
    // Видаляємо саме його, щоб не запускати dispatcher двічі.
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.id === 'bot-daily-report-7am') {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }

    await this.queue.add(
      'digest-dispatch',
      { trigger: 'scheduled' },
      {
        // Щогодини о :05. BotAdminService сам визначає, кому настав час,
        // і захищає від повторної відправки за telegramDigestLastSentAt.
        repeat: { pattern: '5 * * * *' },
        jobId: 'bot-digest-hourly',
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    );
  }
}
