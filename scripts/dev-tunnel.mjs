#!/usr/bin/env node
/**
 * Публічний HTTPS для локальної розробки:
 * - tracking-посилання /l/ та /r/ (для інших людей)
 * - Telegram webhook /telegram/webhook
 *
 * Запуск: pnpm dev:tunnel  (спочатку pnpm dev)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const webEnvPath = join(root, 'apps/web/.env.local');

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        const key = l.slice(0, i);
        const val = l.slice(i + 1).replace(/^"|"$/g, '');
        return [key, val];
      }),
  );
}

function loadEnv() {
  return { ...loadEnvFile(envPath), ...loadEnvFile(webEnvPath) };
}

function patchEnvFile(path, updates) {
  if (!existsSync(path)) return;
  let raw = readFileSync(path, 'utf8');
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}="${value}"`;
    if (new RegExp(`^${key}=`, 'm').test(raw)) {
      raw = raw.replace(new RegExp(`^${key}=.*$`, 'm'), line);
    } else {
      raw += `\n${line}`;
    }
  }
  writeFileSync(path, raw.endsWith('\n') ? raw : `${raw}\n`);
}

function resolveWebPort() {
  const env = loadEnv();
  if (env.WEB_PORT) return env.WEB_PORT;
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? '';
  const m = appUrl.match(/:(\d+)/);
  return m?.[1] ?? '3002';
}

async function setTelegramWebhook(env, baseUrl) {
  if (env.TELEGRAM_USE_POLLING === 'true') {
    console.log('\n⊘ Webhook пропущено (TELEGRAM_USE_POLLING=true, використовується polling)\n');
    return null;
  }
  const url = `${baseUrl}/telegram/webhook`;
  const params = new URLSearchParams({
    url,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
  });
  const res = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?${params}`,
  );
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description ?? 'setWebhook failed');
  }
  return url;
}

const port = resolveWebPort();

const lt = spawn('npx', ['--yes', 'localtunnel', '--port', port], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
});

let configured = false;

lt.stdout.on('data', async (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  const match = text.match(/https:\/\/[^\s]+\.loca\.lt/);
  if (!match || configured) return;
  configured = true;
  const base = match[0];
  try {
    const env = loadEnv();
    const webhook = await setTelegramWebhook(env, base);
    patchEnvFile(envPath, {
      ...(webhook ? { TELEGRAM_WEBHOOK_URL: webhook } : {}),
      NEXT_PUBLIC_APP_URL: base,
    });
    patchEnvFile(webEnvPath, {
      NEXT_PUBLIC_APP_URL: base,
    });
    writeFileSync(join(root, 'apps/api/.env'), readFileSync(envPath, 'utf8'));

    console.log('\n✓ Публічний URL (ділитися з іншими):', base);
    console.log('  Приклад посилання:     ', `${base}/l/ВАШ_SLUG`);
    if (webhook) console.log('  Telegram webhook:      ', webhook);
    else console.log('  Telegram: polling (див. Учасники)');
    console.log('\n  Перезапустіть pnpm dev — щоб у адмінці показувались публічні URL.');
    console.log('  Тунель залиште відкритим.\n');
  } catch (err) {
    console.error('\n✗ Помилка налаштування:', err.message);
  }
});

lt.on('exit', (code) => process.exit(code ?? 0));

process.on('SIGINT', () => {
  lt.kill();
  process.exit(0);
});
