import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RetentionService } from './retention.service';
import { RetentionProcessor, RETENTION_QUEUE } from './retention.processor';
import { RetentionScheduler } from './retention.scheduler';
import { RetentionController } from './retention.controller';
import { TelegramModule } from '../telegram/telegram.module';
import { ConversionModule } from '../conversion/conversion.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: RETENTION_QUEUE }),
    TelegramModule,
    ConversionModule,
  ],
  controllers: [RetentionController],
  providers: [RetentionService, RetentionProcessor, RetentionScheduler],
  exports: [RetentionService],
})
export class RetentionModule {}
