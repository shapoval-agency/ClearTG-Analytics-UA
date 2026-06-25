import { createHash, createHmac, randomBytes } from 'crypto';

export function hashIp(ip: string, salt: string): string {
  return createHmac('sha256', salt).update(ip).digest('hex');
}

export function hashUserAgent(userAgent: string, salt: string): string {
  return createHmac('sha256', salt).update(userAgent).digest('hex');
}

export function hashExternalId(
  telegramUserId: string,
  workspaceId: string,
  salt: string,
): string {
  return createHmac('sha256', salt)
    .update(`${workspaceId}:${telegramUserId}`)
    .digest('hex');
}

export function generateEventId(): string {
  return createHash('sha256')
    .update(randomBytes(16))
    .digest('hex')
    .slice(0, 32);
}

export function generateSlug(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
