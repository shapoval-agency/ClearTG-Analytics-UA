import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InviteLinkService } from './invite-link.service';

export const INVITE_LINK_HEALTH_QUEUE = 'invite-link-health-check';

@Processor(INVITE_LINK_HEALTH_QUEUE)
export class InviteLinkHealthProcessor extends WorkerHost {
  constructor(private inviteLinks: InviteLinkService) {
    super();
  }

  async process(job: Job<{ trigger: string }>) {
    return this.inviteLinks.checkStandaloneLinksHealth();
  }
}
