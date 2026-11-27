import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { PublicApiService } from './public-api.service';
import { API_RATE_LIMIT_PER_MINUTE, extractApiKey } from './public-api';

/**
 * Доступ до /api/v1 — лише за API-ключем кабінету. Маршрути позначені
 * @Public(), тож JWT-guard їх пропускає, а кабінет визначається ключем,
 * а не заголовком x-workspace-id.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private service: PublicApiService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ headers: Record<string, string | string[] | undefined>; workspaceId?: string; apiKeyId?: string }>();
    const reply = http.getResponse<{ header: (name: string, value: string | number) => unknown }>();

    const raw = extractApiKey(request.headers);
    if (!raw) throw new UnauthorizedException('API key required: send "Authorization: Bearer ctg_…"');

    const key = await this.service.resolveKey(raw);
    if (!key) throw new UnauthorizedException('API key is invalid, revoked or expired');

    const limit = await this.service.takeRateLimit(key.id);
    reply.header('X-RateLimit-Limit', API_RATE_LIMIT_PER_MINUTE);
    if (!limit.allowed) {
      reply.header('Retry-After', limit.retryAfterSec);
      throw new HttpException(`Rate limit: ${API_RATE_LIMIT_PER_MINUTE} requests per minute`, HttpStatus.TOO_MANY_REQUESTS);
    }

    request.workspaceId = key.workspaceId;
    request.apiKeyId = key.id;
    return true;
  }
}
