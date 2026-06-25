import { Module, forwardRef } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { InviteLinkService } from './invite-link.service';
import { AttributionModule } from '../attribution/attribution.module';
import { ConversionModule } from '../conversion/conversion.module';
import { LeadMagnetModule } from '../lead-magnet/lead-magnet.module';

@Module({
  imports: [
    forwardRef(() => AttributionModule),
    forwardRef(() => ConversionModule),
    forwardRef(() => LeadMagnetModule),
  ],
  controllers: [TelegramController],
  providers: [TelegramService, InviteLinkService],
  exports: [TelegramService, InviteLinkService],
})
export class TelegramModule {}
