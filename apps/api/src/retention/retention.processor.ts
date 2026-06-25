import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RetentionService } from './retention.service';

export const RETENTION_QUEUE = 'retention-check';

@Processor(RETENTION_QUEUE)
export class RetentionProcessor extends WorkerHost {
  constructor(private retention: RetentionService) {
    super();
  }

  async process(job: Job<{ trigger: string }>) {
    return this.retention.runRetentionCheck();
  }
}
