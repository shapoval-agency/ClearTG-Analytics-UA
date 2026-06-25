import { Module } from '@nestjs/common';
import { GA4Service } from './ga4.service';
import { GA4Controller } from './ga4.controller';

@Module({
  controllers: [GA4Controller],
  providers: [GA4Service],
  exports: [GA4Service],
})
export class GA4Module {}
