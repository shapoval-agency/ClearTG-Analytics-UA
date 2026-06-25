export interface TikTokEventInput {
  pixelId: string;
  eventName: string;
  eventTime: Date;
  eventId: string;
  ttclid?: string | null;
  ttp?: string | null;
  externalIdHash?: string | null;
  consentAdUserDataGranted: boolean;
  testEventCode?: string | null;
}

const TIKTOK_EVENT_MAP: Record<string, string> = {
  TG_Subscribe: 'CompleteRegistration',
  TG_Qualified_Subscribe_D1: 'QualifiedSubscribeD1',
  TG_Qualified_Subscribe_D7: 'QualifiedSubscribeD7',
  TG_Qualified_Subscribe_D30: 'QualifiedSubscribeD30',
  LeadMagnet_Claimed: 'LeadMagnetClaimed',
};

export function mapTikTokEventName(internalName: string): string {
  return TIKTOK_EVENT_MAP[internalName] ?? internalName;
}

export function buildTikTokEventPayload(input: TikTokEventInput) {
  const user: Record<string, string> = {};

  if (input.ttclid) user.ttclid = input.ttclid;
  if (input.ttp) user.ttp = input.ttp;
  if (input.externalIdHash && input.consentAdUserDataGranted) {
    user.external_id = input.externalIdHash;
  }

  const body: Record<string, unknown> = {
    event_source: 'web',
    event_source_id: input.pixelId,
    data: [
      {
        event: mapTikTokEventName(input.eventName),
        event_time: Math.floor(input.eventTime.getTime() / 1000),
        event_id: input.eventId,
        user,
        properties: {
          content_name: input.eventName,
        },
      },
    ],
  };

  if (input.testEventCode) {
    body.test_event_code = input.testEventCode;
  }

  return body;
}

export function canSendTikTokEvent(input: TikTokEventInput): boolean {
  const hasClickId = !!(input.ttclid || input.ttp);
  const hasExternalId = !!(input.externalIdHash && input.consentAdUserDataGranted);
  return hasClickId || hasExternalId;
}

export function isTikTokSuccessResponse(body: { code?: number }): boolean {
  return body.code === 0;
}
