import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { CryptoService } from '../../crypto/crypto.service';

export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
  token_type?: string;
}

const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';
const STATE_TTL_SEC = 600;

@Injectable()
export class GoogleAdsOAuthService {
  private redis: Redis;

  constructor(
    private config: ConfigService,
    private crypto: CryptoService,
  ) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
  }

  getAuthUrl(workspaceId: string): string {
    const clientId = this.config.get<string>('GOOGLE_ADS_CLIENT_ID');
    const redirectUri = this.getRedirectUri();
    if (!clientId) throw new Error('GOOGLE_ADS_CLIENT_ID not configured');

    const state = randomBytes(16).toString('hex');
    void this.redis.set(`gads_oauth:${state}`, workspaceId, 'EX', STATE_TTL_SEC);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_ADS_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string, state: string): Promise<{ workspaceId: string; tokens: GoogleOAuthTokens }> {
    const workspaceId = await this.redis.get(`gads_oauth:${state}`);
    if (!workspaceId) throw new Error('Invalid or expired OAuth state');
    await this.redis.del(`gads_oauth:${state}`);

    const clientId = this.config.get<string>('GOOGLE_ADS_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_ADS_CLIENT_SECRET');
    const redirectUri = this.getRedirectUri();
    if (!clientId || !clientSecret) throw new Error('Google OAuth not configured');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description ?? data.error ?? 'Token exchange failed');
    }

    const tokens: GoogleOAuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
      scope: data.scope,
      token_type: data.token_type,
    };

    return { workspaceId, tokens };
  }

  encryptTokens(tokens: GoogleOAuthTokens): string {
    return this.crypto.encrypt(JSON.stringify(tokens));
  }

  decryptTokens(encrypted: string): GoogleOAuthTokens {
    return JSON.parse(this.crypto.decrypt(encrypted)) as GoogleOAuthTokens;
  }

  async getValidAccessToken(encrypted: string): Promise<{ accessToken: string; updatedEnc?: string }> {
    const tokens = this.decryptTokens(encrypted);
    if (tokens.expires_at > Date.now() + 60_000) {
      return { accessToken: tokens.access_token };
    }

    if (!tokens.refresh_token) {
      throw new Error('Google OAuth refresh token missing — reconnect integration');
    }

    const clientId = this.config.get<string>('GOOGLE_ADS_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_ADS_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new Error('Google OAuth not configured');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description ?? 'Token refresh failed');
    }

    const refreshed: GoogleOAuthTokens = {
      ...tokens,
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    };

    return {
      accessToken: refreshed.access_token,
      updatedEnc: this.encryptTokens(refreshed),
    };
  }

  getRedirectUri(): string {
    return (
      this.config.get<string>('GOOGLE_ADS_REDIRECT_URI') ??
      `${this.config.get<string>('API_URL') ?? 'http://localhost:3001'}/api/integrations/google-ads/callback`
    );
  }
}
