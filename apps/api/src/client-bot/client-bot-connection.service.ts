import { BadRequestException, Injectable, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { Bot } from 'grammy';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { ClientBotRuntimeService } from './client-bot-runtime.service';

@Injectable()
export class ClientBotConnectionService {
  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    @Inject(forwardRef(() => ClientBotRuntimeService))
    private runtime: ClientBotRuntimeService,
  ) {}

  async create(workspaceId: string, rawToken: string) {
    const token = rawToken.trim();

    let username: string;
    try {
      const probe = new Bot(token);
      const me = await probe.api.getMe();
      username = me.username;
    } catch {
      throw new BadRequestException('Невірний токен бота — Telegram його не приймає');
    }

    const tokenEnc = this.crypto.encrypt(token);
    const connection = await this.prisma.telegramBotConnection.create({
      data: { workspaceId, botUsername: username, tokenEnc, isActive: true },
    });

    await this.runtime.startBot(connection.id, token);

    return this.toPublic(connection);
  }

  async list(workspaceId: string) {
    const rows = await this.prisma.telegramBotConnection.findMany({
      where: { workspaceId },
      orderBy: { connectedAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async remove(workspaceId: string, id: string) {
    const row = await this.prisma.telegramBotConnection.findFirst({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Bot connection not found');

    await this.runtime.stopBot(id);
    await this.prisma.telegramBotConnection.delete({ where: { id } });
    return { ok: true };
  }

  async getDecryptedToken(id: string): Promise<string | null> {
    const row = await this.prisma.telegramBotConnection.findUnique({ where: { id } });
    if (!row) return null;
    return this.crypto.decrypt(row.tokenEnc);
  }

  async markError(id: string, message: string) {
    await this.prisma.telegramBotConnection.update({
      where: { id },
      data: { isActive: false, lastError: message, lastErrorAt: new Date() },
    });
  }

  private toPublic(row: {
    id: string;
    botUsername: string;
    isActive: boolean;
    lastError: string | null;
    lastErrorAt: Date | null;
    connectedAt: Date;
  }) {
    return {
      id: row.id,
      botUsername: row.botUsername,
      isActive: row.isActive,
      lastError: row.lastError,
      lastErrorAt: row.lastErrorAt,
      connectedAt: row.connectedAt,
    };
  }
}
