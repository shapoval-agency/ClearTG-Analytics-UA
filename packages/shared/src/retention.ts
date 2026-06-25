export type RetentionDay = 1 | 7 | 30;

export interface RetentionCheckCandidate {
  id: string;
  subscribedAt: Date;
  retainedD1: boolean | null;
  retainedD7: boolean | null;
  retainedD30: boolean | null;
}

export function getRetentionField(day: RetentionDay): 'retainedD1' | 'retainedD7' | 'retainedD30' {
  if (day === 1) return 'retainedD1';
  if (day === 7) return 'retainedD7';
  return 'retainedD30';
}

export function isRetentionDue(subscribedAt: Date, day: RetentionDay, now = new Date()): boolean {
  const msPerDay = 24 * 60 * 60 * 1000;
  const elapsed = now.getTime() - subscribedAt.getTime();
  return elapsed >= day * msPerDay;
}

export function shouldCheckRetention(
  profile: RetentionCheckCandidate,
  day: RetentionDay,
  now = new Date(),
): boolean {
  const field = getRetentionField(day);
  if (profile[field] !== null) return false;
  return isRetentionDue(profile.subscribedAt, day, now);
}

export const ACTIVE_MEMBER_STATUSES = new Set([
  'member',
  'administrator',
  'creator',
  'restricted',
]);

export function isActiveMemberStatus(status: string): boolean {
  return ACTIVE_MEMBER_STATUSES.has(status);
}
