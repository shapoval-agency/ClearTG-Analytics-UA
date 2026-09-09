import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { INVITE_LINK_HEALTH_QUEUE } from './invite-link-health.processor';

@Injectable()
export class InviteLinkHealthScheduler implements OnModuleInit {
  constructor(@InjectQueue(INVITE_LINK_HEALTH_QUEUE) private queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(
      'invite-link-health-check',
      { trigger: 'scheduled' },
      {
        // Зсунуто на :30, щоб не бити по Telegram API в ту саму хвилину,
        // що й retention-hourly (:00).
        repeat: { pattern: '30 * * * *' },
        jobId: 'invite-link-health-hourly',
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }
}
