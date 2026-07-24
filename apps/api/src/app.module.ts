import './load-env';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './common/logger.module';
import { MailModule } from './common/mail.module';
import { CryptoModule } from './crypto/crypto.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ChannelModule } from './channel/channel.module';
import { CampaignModule } from './campaign/campaign.module';
import { TrackingModule } from './tracking/tracking.module';
import { TelegramModule } from './telegram/telegram.module';
import { AttributionModule } from './attribution/attribution.module';
import { ConversionModule } from './conversion/conversion.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrivacyModule } from './privacy/privacy.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { RetentionModule } from './retention/retention.module';
import { LeadMagnetModule } from './lead-magnet/lead-magnet.module';
import { AgencyModule } from './agency/agency.module';
import { ClientBotModule } from './client-bot/client-bot.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '.env'),
        join(__dirname, '..', '..', '.env'),
      ],
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
    }),
    PrismaModule,
    LoggerModule,
    MailModule,
    CryptoModule,
    WorkspaceModule,
    ChannelModule,
    CampaignModule,
    TrackingModule,
    TelegramModule,
    AttributionModule,
    ConversionModule,
    IntegrationsModule,
    DashboardModule,
    PrivacyModule,
    AuditModule,
    AuthModule,
    RetentionModule,
    LeadMagnetModule,
    AgencyModule,
    ClientBotModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
