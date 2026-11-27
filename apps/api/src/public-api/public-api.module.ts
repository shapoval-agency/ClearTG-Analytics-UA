import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PublicApiService } from './public-api.service';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyController, PublicApiV1Controller } from './public-api.controller';

@Module({
  imports: [AuditModule],
  controllers: [ApiKeyController, PublicApiV1Controller],
  providers: [PublicApiService, ApiKeyGuard],
})
export class PublicApiModule {}
