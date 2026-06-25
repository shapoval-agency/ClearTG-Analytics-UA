import { Module } from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { GoogleAdsOAuthService } from './google-ads-oauth.service';
import { GoogleAdsController } from './google-ads.controller';

@Module({
  controllers: [GoogleAdsController],
  providers: [GoogleAdsService, GoogleAdsOAuthService],
  exports: [GoogleAdsService],
})
export class GoogleAdsModule {}
