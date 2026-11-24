import { Module, forwardRef } from '@nestjs/common';
import { LandingPageController, ShortlinkController, TrackingLinksController, CleartgScriptController, TrackingOpenController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TelegramModule } from '../telegram/telegram.module';
import { ConversionModule } from '../conversion/conversion.module';

@Module({
  imports: [forwardRef(() => TelegramModule), ConversionModule],
  controllers: [LandingPageController, ShortlinkController, TrackingLinksController, CleartgScriptController, TrackingOpenController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
