import { Module, forwardRef } from '@nestjs/common';
import { LeadMagnetController } from './lead-magnet.controller';
import { LeadMagnetService } from './lead-magnet.service';
import { ConversionModule } from '../conversion/conversion.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ConversionModule, forwardRef(() => TelegramModule), AuditModule],
  controllers: [LeadMagnetController],
  providers: [LeadMagnetService],
  exports: [LeadMagnetService],
})
export class LeadMagnetModule {}
