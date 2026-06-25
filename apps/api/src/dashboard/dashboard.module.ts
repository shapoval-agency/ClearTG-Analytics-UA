import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AttributionModule } from '../attribution/attribution.module';
import { ConversionModule } from '../conversion/conversion.module';

@Module({
  imports: [AttributionModule, ConversionModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
