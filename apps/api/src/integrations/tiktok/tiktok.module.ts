import { Module } from '@nestjs/common';
import { TikTokService } from './tiktok.service';
import { TikTokController } from './tiktok.controller';

@Module({
  controllers: [TikTokController],
  providers: [TikTokService],
  exports: [TikTokService],
})
export class TikTokModule {}
