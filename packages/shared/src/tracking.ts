import { UAParser } from 'ua-parser-js';

export interface ParsedUserAgent {
  browser: string | null;
  device: string | null;
  os: string | null;
}

export function parseUserAgent(userAgent: string): ParsedUserAgent {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    browser: result.browser.name
      ? `${result.browser.name}${result.browser.version ? ` ${result.browser.version}` : ''}`
      : null,
    device: result.device.type ?? 'desktop',
    os: result.os.name
      ? `${result.os.name}${result.os.version ? ` ${result.os.version}` : ''}`
      : null,
  };
}

export function extractClickIds(query: Record<string, string | undefined>) {
  return {
    fbclid: query.fbclid ?? null,
    fbp: query.fbp ?? query._fbp ?? null,
    fbc: query.fbc ?? query._fbc ?? null,
    gclid: query.gclid ?? null,
    gbraid: query.gbraid ?? null,
    wbraid: query.wbraid ?? null,
    ttclid: query.ttclid ?? null,
    ttp: query.ttp ?? query._ttp ?? null,
    gaClientId: query.ga_client_id ?? query._ga ?? null,
    gaSessionId: query.ga_session_id ?? null,
    utmSource: query.utm_source ?? null,
    utmMedium: query.utm_medium ?? null,
    utmCampaign: query.utm_campaign ?? null,
    utmContent: query.utm_content ?? null,
    utmTerm: query.utm_term ?? null,
  };
}
