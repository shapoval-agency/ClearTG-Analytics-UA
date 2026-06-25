import { Module, forwardRef } from '@nestjs/common';
import { LandingPageController, ShortlinkController, TrackingLinksController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [forwardRef(() => TelegramModule)],
  controllers: [LandingPageController, ShortlinkController, TrackingLinksController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
