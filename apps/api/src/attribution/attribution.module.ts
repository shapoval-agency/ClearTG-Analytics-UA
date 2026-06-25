import { Module } from '@nestjs/common';
import { AttributionService } from './attribution.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [AttributionService],
  exports: [AttributionService],
})
export class AttributionModule {}
