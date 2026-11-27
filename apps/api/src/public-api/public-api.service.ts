import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  API_RATE_LIMIT_PER_MINUTE,
  MAX_API_KEYS_PER_WORKSPACE,
  generateApiKey,
  hashApiKey,
  isStillSubscribed,
  toSubscriptionDto,
  type LookupQuery,
} from './public-api';

const KEY_MANAGER_ROLES = new Set(['OWNER', 'ADMIN']);
/** lastUsedAt оновлюємо не частіше разу на хвилину — без запису в БД на кожен запит. */
const LAST_USED_THROTTLE_MS = 60_000;

export interface ResolvedApiKey {
  id: string;
  workspaceId: string;
}

@Injectable()
export class PublicApiService {
  private readonly logger = new Logger(PublicApiService.name);
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    config: ConfigService,
  ) {
    this.redis = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
  }

  // ── Керування ключами (кабінет) ─────────────────────────────────────

  list(workspaceId: string) {
    return this.prisma.apiKey.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    });
  }

  async create(workspaceId: string, userId: string, role: string | undefined, name: string) {
    this.assertCanManage(role);
    const count = await this.prisma.apiKey.count({ where: { workspaceId } });
    if (count >= MAX_API_KEYS_PER_WORKSPACE) {
      throw new BadRequestException(`Можна мати до ${MAX_API_KEYS_PER_WORKSPACE} ключів. Відкличте непотрібний і створіть новий.`);
    }
    const key = generateApiKey();
    const created = await this.prisma.apiKey.create({
      data: { workspaceId, name: name.trim(), keyHash: hashApiKey(key) },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    });
    await this.audit.log({ workspaceId, userId, action: 'api_key.created', entityType: 'ApiKey', entityId: created.id, metadata: { name: created.name } });
    return { ...created, key };
  }

  async revoke(workspaceId: string, userId: string, role: string | undefined, id: string) {
    this.assertCanManage(role);
    const key = await this.prisma.apiKey.findFirst({ where: { id, workspaceId }, select: { id: true, name: true } });
    if (!key) throw new NotFoundException('Ключ не знайдено — можливо, його вже відкликали.');
    await this.prisma.apiKey.delete({ where: { id: key.id } });
    await this.audit.log({ workspaceId, userId, action: 'api_key.revoked', entityType: 'ApiKey', entityId: key.id, metadata: { name: key.name } });
    return { ok: true };
  }

  private assertCanManage(role: string | undefined) {
    if (!role || !KEY_MANAGER_ROLES.has(role)) {
      throw new ForbiddenException('Створювати й відкликати ключі можуть лише власник і адміністратори кабінету.');
    }
  }

  // ── Перевірка ключа і ліміт (публічний API) ─────────────────────────

  async resolveKey(rawKey: string): Promise<ResolvedApiKey | null> {
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(rawKey) },
      select: { id: true, workspaceId: true, lastUsedAt: true, expiresAt: true },
    });
    if (!key) return null;
    if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) return null;
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
      this.prisma.apiKey
        .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
        .catch((err: unknown) => this.logger.warn(`lastUsedAt update failed: ${String(err)}`));
    }
    return { id: key.id, workspaceId: key.workspaceId };
  }

  /**
   * Фіксоване вікно на хвилину. Якщо Redis недоступний — пропускаємо запит:
   * ліміт захищає від перевантаження, а не від доступу (доступ дає ключ).
   */
  async takeRateLimit(keyId: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
    const windowSec = Math.floor(Date.now() / 60_000);
    const redisKey = `api_rl:${keyId}:${windowSec}`;
    try {
      const count = await this.redis.incr(redisKey);
      if (count === 1) await this.redis.expire(redisKey, 70);
      const retryAfterSec = 60 - Math.floor((Date.now() / 1000) % 60);
      return { allowed: count <= API_RATE_LIMIT_PER_MINUTE, retryAfterSec };
    } catch (err) {
      this.logger.warn(`Rate limit check skipped: ${String(err)}`);
      return { allowed: true, retryAfterSec: 0 };
    }
  }

  // ── S4-12: джерело людини ───────────────────────────────────────────

  async lookupSource(workspaceId: string, query: LookupQuery, channelId?: string) {
    const who =
      'telegramUserId' in query
        ? { telegramUserId: query.telegramUserId }
        : { telegramUsername: { equals: query.username, mode: 'insensitive' as const } };

    const subscriptions = await this.prisma.membershipEvent.findMany({
      where: {
        workspaceId,
        ...(channelId ? { channelId } : {}),
        eventType: { in: ['SUBSCRIBE', 'JOIN_REQUEST_APPROVED'] },
        ...who,
      },
      orderBy: { occurredAt: 'desc' },
      take: 50,
      select: {
        occurredAt: true,
        channelId: true,
        telegramUserId: true,
        channel: { select: { id: true, title: true, username: true } },
        attribution: {
          select: {
            attributionType: true,
            campaign: { select: { id: true, name: true } },
            trackingLink: {
              select: {
                id: true, name: true,
                utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true, utmTerm: true,
              },
            },
          },
        },
      },
    });

    if (subscriptions.length === 0) {
      return { found: false, telegram_user_id: 'telegramUserId' in query ? query.telegramUserId : null, subscriptions: [] };
    }

    const userIds = [...new Set(subscriptions.map((s) => s.telegramUserId))];
    const unsubscribes = await this.prisma.membershipEvent.findMany({
      where: { workspaceId, eventType: 'UNSUBSCRIBE', telegramUserId: { in: userIds } },
      select: { channelId: true, telegramUserId: true, occurredAt: true },
    });
    const unsubscribedAt = (channel: string, user: string) =>
      unsubscribes.filter((u) => u.channelId === channel && u.telegramUserId === user).map((u) => u.occurredAt);

    return {
      found: true,
      // За username теоретично можуть знайтися різні люди (ім'я передали іншому) — тоді беремо найсвіжішу.
      telegram_user_id: subscriptions[0].telegramUserId,
      subscriptions: subscriptions
        .filter((s) => s.telegramUserId === subscriptions[0].telegramUserId)
        .map((s) => toSubscriptionDto(s, isStillSubscribed(s.occurredAt, unsubscribedAt(s.channelId, s.telegramUserId)))),
    };
  }
}
