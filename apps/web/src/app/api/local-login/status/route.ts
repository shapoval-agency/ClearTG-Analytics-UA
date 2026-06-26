import { NextResponse } from 'next/server';
import {
  getLocalCredentials,
  isLocalMode,
  isLocalPasswordConfigured,
} from '@/lib/local-mode';

/** Перевірка конфігурації (без секретів) — відкрийте /api/local-login/status */
export async function GET() {
  if (!isLocalMode()) {
    return NextResponse.json({ localMode: false });
  }

  const { email } = getLocalCredentials();
  const at = email.indexOf('@');
  const emailHint =
    at > 0 ? `${email.slice(0, 2)}***${email.slice(at)}` : '(не задано)';

  return NextResponse.json({
    localMode: true,
    emailHint,
    passwordConfigured: isLocalPasswordConfigured(),
    defaultPasswordInUse: !isLocalPasswordConfigured(),
  });
}
