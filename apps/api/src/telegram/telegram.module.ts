import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { InviteLinkService } from './invite-link.service';
import { InviteLinkController } from './invite-link.controller';
import { InviteLinkHealthScheduler } from './invite-link-health.scheduler';
import { InviteLinkHealthProcessor, INVITE_LINK_HEALTH_QUEUE } from './invite-link-health.processor';
import { BotAdminService } from './bot-admin.service';
import { BotReportScheduler, BOT_REPORT_QUEUE } from './bot-report.scheduler';
import { BotReportProcessor } from './bot-report.processor';
import { AttributionModule } from '../attribution/attribution.module';
import { ConversionModule } from '../conversion/conversion.module';
import { LeadMagnetModule } from '../lead-magnet/lead-magnet.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: BOT_REPORT_QUEUE }),
    BullModule.registerQueue({ name: INVITE_LINK_HEALTH_QUEUE }),
    forwardRef(() => AttributionModule),
    forwardRef(() => ConversionModule),
    forwardRef(() => LeadMagnetModule),
  ],
  controllers: [TelegramController, InviteLinkController],
  providers: [
    TelegramService,
    InviteLinkService,
    BotAdminService,
    BotReportScheduler,
    BotReportProcessor,
    InviteLinkHealthScheduler,
    InviteLinkHealthProcessor,
  ],
  exports: [TelegramService, InviteLinkService, BotAdminService],
})
export class TelegramModule {}
