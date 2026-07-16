import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRequire } from 'module';
import type { Transporter } from 'nodemailer';
import { LoggerService } from './logger.service';

// nodemailer is CJS — default ESM import is undefined under Nest/commonjs
const require_ = createRequire(__filename);
const nodemailer = require_('nodemailer') as typeof import('nodemailer');

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;

  constructor(
    private config: ConfigService,
    private logger: LoggerService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST')?.trim());
  }

  private getTransporter(): Transporter | null {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) return null;

    if (!this.transporter) {
      const port = parseInt(this.config.get<string>('SMTP_PORT') ?? '465', 10);
      const secureRaw = this.config.get<string>('SMTP_SECURE');
      const secure =
        secureRaw === 'true' || secureRaw === '1' || (!secureRaw && port === 465);

      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: this.config.get<string>('SMTP_USER') ?? '',
          pass: this.config.get<string>('SMTP_PASS') ?? '',
        },
      });
    }

    return this.transporter;
  }

  private fromAddress(): string {
    return (
      this.config.get<string>('SMTP_FROM')?.trim() ||
      this.config.get<string>('EMAIL_FROM')?.trim() ||
      this.config.get<string>('SMTP_USER')?.trim() ||
      'noreply@cleartg.ua'
    );
  }

  async send(input: SendMailInput): Promise<{ sent: boolean; error?: string }> {
    const transport = this.getTransporter();
    if (!transport) {
      this.logger.warn(
        `SMTP not configured — email to ${input.to} skipped. Subject: ${input.subject}`,
        'Mail',
      );
      return { sent: false, error: 'SMTP_HOST not set' };
    }

    try {
      await transport.sendMail({
        from: this.fromAddress(),
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html ?? `<pre style="font-family:sans-serif">${input.text}</pre>`,
      });
      this.logger.log(`Email sent to ${input.to}: ${input.subject}`, 'Mail');
      return { sent: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send email to ${input.to}: ${message}`, 'Mail');
      return { sent: false, error: message };
    }
  }
}
