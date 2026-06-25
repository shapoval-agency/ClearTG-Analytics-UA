import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RETENTION_QUEUE } from './retention.processor';

@Injectable()
export class RetentionScheduler implements OnModuleInit {
  constructor(@InjectQueue(RETENTION_QUEUE) private queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      'daily-retention',
      { trigger: 'scheduled' },
      {
        repeat: { pattern: '0 * * * *' },
        jobId: 'retention-hourly',
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }
}
