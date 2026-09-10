/**
 * QA-смок-тест трекинг-ссылок: слой 1 автоматизации из .qa/LINK_TYPES_TESTING_GUIDE.md.
 *
 * Что делает: сам создаёт одноразовый workspace/канал/ссылки, сам "кликает"
 * по ним через реальный API (нужен запущенный `pnpm --filter @cleartg/api dev`),
 * сам проверяет ответ и БД, сам всё за собой удаляет. Ничего руками кликать
 * не нужно — просто прочитать зелёный/красный отчёт в конце.
 *
 * Запуск: pnpm --filter @cleartg/api qa:smoke-tracking
 * (по умолчанию бьёт в http://localhost:3001 — поменяй через API_BASE_URL)
 *
 * Автоматизирует пункты гайда:
 *  - "мгновенный редирект" (п.5): дефолтная ссылка обязана вернуть 302 без HTML.
 *  - "Відкрив Telegram" фиксируется даже без видимой страницы.
 *  - ссылка с задержкой обязана вернуть HTML-страницу (200), а не редирект.
 *  - недоступный канал обязан вернуть понятную страницу, а не мёртвую ссылку.
 */
import { PrismaClient } from '@cleartg/database';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';
const prisma = new PrismaClient();

type CheckResult = { name: string; ok: boolean; detail?: string };
const results: CheckResult[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function fetchNoRedirect(path: string) {
  return fetch(`${API_BASE_URL}${path}`, { redirect: 'manual' });
}

async function main() {
  console.log(`\nQA smoke-test трекинг-ссылок против ${API_BASE_URL}\n`);

  const stamp = Date.now();
  const workspace = await prisma.workspace.create({
    data: { name: `QA Smoke ${stamp}`, slug: `qa-smoke-${stamp}` },
  });
  const channel = await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      telegramChatId: `-100${stamp}`,
      title: 'QA Smoke Channel',
      username: 'qa_smoke_channel',
      botIsAdmin: false,
    },
  });

  try {
    // --- Кейс 1: дефолтная ссылка (autoRedirect=true, delay=0) ---
    const instantLink = await prisma.trackingLink.create({
      data: {
        workspaceId: workspace.id,
        channelId: channel.id,
        slug: `qa-instant-${stamp}`,
        name: 'QA instant',
        linkMode: 'SHORTLINK',
        destinationMode: 'INVITE_LINK',
        usePerClickInvite: false,
      },
    });

    const instantRes = await fetchNoRedirect(`/r/${instantLink.slug}`);
    check(
      'Дефолтная ссылка отвечает 302 (мгновенный редирект, без страницы)',
      instantRes.status === 302,
      `реально получили ${instantRes.status}`,
    );
    check(
      'Location ведёт в t.me',
      /^https:\/\/t\.me\//.test(instantRes.headers.get('location') ?? ''),
      instantRes.headers.get('location') ?? '(нет Location)',
    );

    const instantClick = await prisma.clickEvent.findFirst({
      where: { trackingLinkId: instantLink.id },
      orderBy: { clickedAt: 'desc' },
    });
    check(
      'Клик записан в БД',
      !!instantClick,
    );
    check(
      '"Відкрив Telegram" (telegramOpenedAt) проставлен сразу, хотя страницы не было',
      !!instantClick?.telegramOpenedAt,
    );

    // --- Кейс 2: ссылка с задержкой — обязана показать реальную HTML-страницу ---
    const delayedLink = await prisma.trackingLink.create({
      data: {
        workspaceId: workspace.id,
        channelId: channel.id,
        slug: `qa-delayed-${stamp}`,
        name: 'QA delayed',
        linkMode: 'SHORTLINK',
        destinationMode: 'INVITE_LINK',
        usePerClickInvite: false,
        redirectDelayMs: 3000,
      },
    });

    const delayedRes = await fetchNoRedirect(`/r/${delayedLink.slug}`);
    const delayedBody = await delayedRes.text();
    check(
      'Ссылка с задержкой возвращает 200 (реальная страница, не редирект)',
      delayedRes.status === 200,
      `реально получили ${delayedRes.status}`,
    );
    check(
      'В HTML есть meta-refresh на Telegram',
      delayedBody.includes('http-equiv="refresh"'),
    );

    // --- Кейс 3: канал недоступен (нет username, бот не админ) ---
    const deadChannel = await prisma.channel.create({
      data: {
        workspaceId: workspace.id,
        telegramChatId: `-101${stamp}`,
        title: 'QA Dead Channel',
        username: null,
        botIsAdmin: false,
      },
    });
    const deadLink = await prisma.trackingLink.create({
      data: {
        workspaceId: workspace.id,
        channelId: deadChannel.id,
        slug: `qa-dead-${stamp}`,
        name: 'QA dead',
        linkMode: 'SHORTLINK',
        destinationMode: 'INVITE_LINK',
        usePerClickInvite: false,
      },
    });

    const deadRes = await fetchNoRedirect(`/r/${deadLink.slug}`);
    const deadBody = await deadRes.text();
    check(
      'Недоступный канал НЕ отдаёт редирект на мёртвую ссылку',
      deadRes.status === 200,
      `реально получили ${deadRes.status}`,
    );
    check(
      'Показана понятная страница "тимчасово недоступний"',
      deadBody.includes('тимчасово недоступний'),
    );
  } finally {
    // Подчищаем за собой, чтобы в БД не копился мусор от каждого прогона.
    await prisma.clickEvent.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.consentEvent.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.trackingLink.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.channel.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.workspace.delete({ where: { id: workspace.id } });
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '✅ Всё сошлось' : `❌ ${failed.length} проверок провалено`}: ${results.length - failed.length}/${results.length}\n`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n💥 Скрипт упал с ошибкой (не смог доехать до проверок):\n', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
