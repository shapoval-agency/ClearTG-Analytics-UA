import { Module } from '@nestjs/common';
import { MetaModule } from './meta/meta.module';
import { GA4Module } from './ga4/ga4.module';
import { GoogleAdsModule } from './google-ads/google-ads.module';
import { TikTokModule } from './tiktok/tiktok.module';

@Module({
  imports: [MetaModule, GA4Module, GoogleAdsModule, TikTokModule],
  exports: [MetaModule, GA4Module, GoogleAdsModule, TikTokModule],
})
export class IntegrationsModule {}
