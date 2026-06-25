import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { ConversionService } from '../conversion/conversion.service';
import { LoggerService } from '../common/logger.service';
import {
  RetentionDay,
  shouldCheckRetention,
  getRetentionField,
  isActiveMemberStatus,
} from '@cleartg/shared';

@Injectable()
export class RetentionService {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private conversion: ConversionService,
    private logger: LoggerService,
  ) {}

  async runRetentionCheck() {
    const results = { d1: 0, d7: 0, d30: 0, errors: 0 };

    for (const day of [1, 7, 30] as RetentionDay[]) {
      const batch = await this.findProfilesToCheck(day);
      for (const profile of batch) {
        try {
          await this.checkProfileRetention(profile, day);
          results[`d${day}` as 'd1' | 'd7' | 'd30']++;
        } catch (err) {
          results.errors++;
          this.logger.error(
            `Retention check failed for ${profile.id} D${day}`,
            err instanceof Error ? err.message : String(err),
            'Retention',
          );
        }
      }
    }

    this.logger.log(`Retention run complete: ${JSON.stringify(results)}`, 'Retention');
    return results;
  }

  private async findProfilesToCheck(day: RetentionDay) {
    const field = getRetentionField(day);
    const msPerDay = 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - day * msPerDay);

    const profiles = await this.prisma.subscriberProfile.findMany({
      where: {
        [field]: null,
        subscribedAt: { lte: cutoff },
      },
      include: {
        channel: { select: { telegramChatId: true, title: true } },
      },
      take: 200,
      orderBy: { subscribedAt: 'asc' },
    });

    return profiles.filter((p) =>
      shouldCheckRetention(
        {
          id: p.id,
          subscribedAt: p.subscribedAt,
          retainedD1: p.retainedD1,
          retainedD7: p.retainedD7,
          retainedD30: p.retainedD30,
        },
        day,
      ),
    );
  }

  private async checkProfileRetention(
    profile: {
      id: string;
      telegramUserId: string;
      channel: { telegramChatId: string };
    },
    day: RetentionDay,
  ) {
    const memberStatus = await this.telegram.getMemberStatus(
      profile.channel.telegramChatId,
      profile.telegramUserId,
    );

    const retained = memberStatus !== null && isActiveMemberStatus(memberStatus);
    const field = getRetentionField(day);

    await this.prisma.subscriberProfile.update({
      where: { id: profile.id },
      data: {
        [field]: retained,
        retentionCheckedAt: new Date(),
      },
    });

    if (retained) {
      const existing = await this.prisma.conversionEvent.findFirst({
        where: {
          subscriberProfileId: profile.id,
          eventName:
            day === 1
              ? 'TG_Qualified_Subscribe_D1'
              : day === 7
                ? 'TG_Qualified_Subscribe_D7'
                : 'TG_Qualified_Subscribe_D30',
        },
      });
      if (!existing) {
        await this.conversion.createRetentionEvent(profile.id, day);
      }
    }
  }
}
