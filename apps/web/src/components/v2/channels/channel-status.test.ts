import { describe, expect, it } from 'vitest';
import { deriveChannelStatus } from './channel-status';

describe('deriveChannelStatus', () => {
  it('не трактує відсутнє legacy-поле права як заборону', () => {
    expect(deriveChannelStatus({
      isActive: true,
      botIsAdmin: true,
    })).toMatchObject({
      status: 'working',
      label: 'Працює',
      tone: 'ok',
    });
  });

  it('показує попередження, коли право явно вимкнене', () => {
    expect(deriveChannelStatus({
      isActive: true,
      botIsAdmin: true,
      botCanInviteUsers: false,
    })).toMatchObject({
      status: 'attention',
      label: 'Потребує уваги',
      tone: 'warn',
    });
  });

  it('показує робочий стан після підтвердженої live-перевірки', () => {
    expect(deriveChannelStatus({
      isActive: true,
      botIsAdmin: true,
      botCanInviteUsers: true,
    })).toMatchObject({
      status: 'working',
      label: 'Працює',
      tone: 'ok',
    });
  });
});
