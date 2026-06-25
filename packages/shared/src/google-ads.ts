export interface GoogleClickConversionInput {
  customerId: string;
  conversionActionId: string;
  eventTime: Date;
  eventId: string;
  currency?: string;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  externalIdHash?: string | null;
  consentAdUserDataGranted: boolean;
}

export function formatGoogleAdsDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}+00:00`;
}

export function buildUploadClickConversionBody(input: GoogleClickConversionInput) {
  const conversionAction = `customers/${input.customerId.replace(/-/g, '')}/conversionActions/${input.conversionActionId}`;

  const conversion: Record<string, unknown> = {
    conversionAction,
    conversionDateTime: formatGoogleAdsDateTime(input.eventTime),
    orderId: input.eventId,
    currencyCode: input.currency ?? 'UAH',
  };

  if (input.gclid) conversion.gclid = input.gclid;
  else if (input.gbraid) conversion.gbraid = input.gbraid;
  else if (input.wbraid) conversion.wbraid = input.wbraid;
  else if (input.externalIdHash && input.consentAdUserDataGranted) {
    conversion.userIdentifiers = [
      {
        thirdPartyUserId: input.externalIdHash,
        userIdentifierSource: 'FIRST_PARTY',
      },
    ];
  }

  return {
    conversions: [conversion],
    partialFailure: true,
  };
}

export function hasGoogleClickIdentifier(input: GoogleClickConversionInput): boolean {
  return !!(input.gclid || input.gbraid || input.wbraid);
}

export function hasGoogleUserIdentifier(input: GoogleClickConversionInput): boolean {
  return !!(input.externalIdHash && input.consentAdUserDataGranted);
}

export function canUploadGoogleConversion(input: GoogleClickConversionInput): boolean {
  return hasGoogleClickIdentifier(input) || hasGoogleUserIdentifier(input);
}
