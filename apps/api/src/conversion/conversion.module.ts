import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConversionService, CONVERSION_QUEUE } from './conversion.service';
import { ConversionDeliveryProcessor } from './conversion.processor';
import { ConversionSettingsController } from './conversion-settings.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: CONVERSION_QUEUE }),
    IntegrationsModule,
  ],
  controllers: [ConversionSettingsController],
  providers: [ConversionService, ConversionDeliveryProcessor],
  exports: [ConversionService],
})
export class ConversionModule {}
