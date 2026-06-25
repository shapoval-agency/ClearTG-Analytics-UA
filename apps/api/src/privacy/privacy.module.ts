import { Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PrivacyController],
})
export class PrivacyModule {}
