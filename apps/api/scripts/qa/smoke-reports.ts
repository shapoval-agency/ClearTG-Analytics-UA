/**
 * QA-смок-тест бекенду звітів: другий шар автоматизації після смок-тесту
 * трекинг-посилань (`smoke-tracking-links.ts`, 2026-09-10).
 *
 * Дашборд-ендпоінти захищені `@RequiresWorkspace()`, тож на відміну від
 * трекинг-смоку тут недоцільно бити напряму в HTTP: довелось би ще й
 * піднімати stagingLogin/JWT, а це перевіряло б auth-стек, якого ця задача
 * не чіпала. Головне, що треба довести — це що самі Prisma-запити
 * `DashboardService` рахують правильно на реальній реляційній базі (не на
 * моках). Тому створюємо сервіс напряму з реальним `PrismaClient`, без
 * HTTP і без Nest DI-контейнера — так само реально б'ємось у Postgres.
 *
 * Перевіряє чотири пункти з `docs/new-dashboard/v2-reports-backend-review.md`:
 *  - Campaign isolation: відписка кампанії A не потрапляє у звіт кампанії B
 *    (регрес на баг з dashboard.service.ts, знайдений 2026-09-11).
 *  - Date filter: `?from=&to=` відсікає кліки поза періодом, київська доба.
 *  - Channel filter: `?channelId=` лишає тільки кампанії свого каналу.
 *  - Reach: `reached`/`reachRate` рахують лише кліки із заповненим `telegramOpenedAt`.
 *
 * Запуск: pnpm --filter @cleartg/api qa:smoke-reports
 * (потрібна лише БД з DATABASE_URL — дев-сервер API піднімати не треба,
 * на відміну від qa:smoke-tracking, який ходить у реальний HTTP).
 */
import { PrismaClient } from '@cleartg/database';
import { DashboardService } from '../../src/dashboard/dashboard.service';

const prisma = new PrismaClient();

type CheckResult = { name: string; ok: boolean; detail?: string };
const results: CheckResult[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Той самий спосіб дістати київський календарний день, що вже є в getDailyDigest(). */
function kyivDateOnly(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
}

async function main() {
  console.log('\nQA smoke-test бекенду звітів (DashboardService) проти реальної БД\n');

  // getCampaignReports() використовує лише this.prisma — attribution/conversion
  // потрібні тільки getOverview(), якого цей скрипт не викликає, тож фейки
  // безпечні: до них узагалі не дійде виклик.
  const dashboard = new DashboardService(prisma as never, {} as never, {} as never);

  const stamp = Date.now();
  const workspace = await prisma.workspace.create({
    data: { name: `QA Reports ${stamp}`, slug: `qa-reports-${stamp}` },
  });
  const channel1 = await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      telegramChatId: `-200${stamp}`,
      title: 'QA Reports Channel 1',
      username: 'qa_reports_channel_1',
      botIsAdmin: true,
    },
  });
  const channel2 = await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      telegramChatId: `-201${stamp}`,
      title: 'QA Reports Channel 2',
      username: 'qa_reports_channel_2',
      botIsAdmin: true,
    },
  });

  try {
    const campaignA = await prisma.campaign.create({
      data: { workspaceId: workspace.id, channelId: channel1.id, name: 'QA Campaign A' },
    });
    const campaignB = await prisma.campaign.create({
      data: { workspaceId: workspace.id, channelId: channel1.id, name: 'QA Campaign B' },
    });
    const campaignX = await prisma.campaign.create({
      data: { workspaceId: workspace.id, channelId: channel2.id, name: 'QA Campaign X (інший канал)' },
    });
    const linkA = await prisma.trackingLink.create({
      data: {
        workspaceId: workspace.id,
        channelId: channel1.id,
        campaignId: campaignA.id,
        slug: `qa-reports-a-${stamp}`,
        name: 'QA link A',
      },
    });

    // --- Цикл підписка → відписка, атрибутований кампанії A ---
    const subA = await prisma.membershipEvent.create({
      data: {
        workspaceId: workspace.id,
        channelId: channel1.id,
        eventType: 'SUBSCRIBE',
        telegramUserId: `qa-user-a-${stamp}`,
        occurredAt: new Date(),
      },
    });
    const profileA = await prisma.subscriberProfile.create({
      data: {
        workspaceId: workspace.id,
        channelId: channel1.id,
        membershipEventId: subA.id,
        externalIdHash: `qa-hash-a-${stamp}`,
        telegramUserId: subA.telegramUserId,
        subscribedAt: subA.occurredAt,
      },
    });
    await prisma.attribution.create({
      data: {
        workspaceId: workspace.id,
        channelId: channel1.id,
        membershipEventId: subA.id,
        attributionType: 'CAMPAIGN_INVITE',
        confidenceScore: 1,
        reason: 'QA fixture',
        campaignId: campaignA.id,
        attributionWindowMinutes: 10080,
      },
    });
    await prisma.unsubscribeEvent.create({
      data: {
        workspaceId: workspace.id,
        channelId: channel1.id,
        telegramUserId: subA.telegramUserId,
        subscriberProfileId: profileA.id,
        occurredAt: new Date(),
      },
    });

    // --- Підписка БЕЗ відписки, атрибутована кампанії B (той самий канал) ---
    const subB = await prisma.membershipEvent.create({
      data: {
        workspaceId: workspace.id,
        channelId: channel1.id,
        eventType: 'SUBSCRIBE',
        telegramUserId: `qa-user-b-${stamp}`,
        occurredAt: new Date(),
      },
    });
    await prisma.subscriberProfile.create({
      data: {
        workspaceId: workspace.id,
        channelId: channel1.id,
        membershipEventId: subB.id,
        externalIdHash: `qa-hash-b-${stamp}`,
        telegramUserId: subB.telegramUserId,
        subscribedAt: subB.occurredAt,
      },
    });
    await prisma.attribution.create({
      data: {
        workspaceId: workspace.id,
        channelId: channel1.id,
        membershipEventId: subB.id,
        attributionType: 'CAMPAIGN_INVITE',
        confidenceScore: 1,
        reason: 'QA fixture',
        campaignId: campaignB.id,
        attributionWindowMinutes: 10080,
      },
    });

    // --- Кліки на Campaign A: два "сьогодні" (один дійшов, один — ні) + один 10 днів тому ---
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

    await prisma.clickEvent.create({
      data: {
        workspaceId: workspace.id, channelId: channel1.id, campaignId: campaignA.id, trackingLinkId: linkA.id,
        clickedAt: now, telegramOpenedAt: now, consentSnapshot: {},
      },
    });
    await prisma.clickEvent.create({
      data: {
        workspaceId: workspace.id, channelId: channel1.id, campaignId: campaignA.id, trackingLinkId: linkA.id,
        clickedAt: now, telegramOpenedAt: null, consentSnapshot: {},
      },
    });
    await prisma.clickEvent.create({
      data: {
        workspaceId: workspace.id, channelId: channel1.id, campaignId: campaignA.id, trackingLinkId: linkA.id,
        clickedAt: tenDaysAgo, telegramOpenedAt: tenDaysAgo, consentSnapshot: {},
      },
    });

    // === 1. Campaign isolation ===
    const allReports = await dashboard.getCampaignReports(workspace.id);
    const rowA = allReports.find((r) => r.id === campaignA.id);
    const rowB = allReports.find((r) => r.id === campaignB.id);
    check('Campaign A показує свою відписку (unsubscribes=1)', rowA?.unsubscribes === 1, `отримали ${rowA?.unsubscribes}`);
    check(
      'Campaign B НЕ успадковує чужу відписку каналу (unsubscribes=0) — регрес на баг dashboard.service.ts',
      rowB?.unsubscribes === 0,
      `отримали ${rowB?.unsubscribes}`,
    );

    // === 2. Reach (без фільтра періоду — усі 3 кліки кампанії A) ===
    check('Без фільтра clicks=3', rowA?.clicks === 3, `отримали ${rowA?.clicks}`);
    check('Без фільтра reached=2 (третій клік теж мав telegramOpenedAt)', rowA?.reached === 2, `отримали ${rowA?.reached}`);
    check(
      'reachRate = 2/3',
      Math.abs((rowA?.reachRate ?? -1) - 2 / 3) < 1e-9,
      `отримали ${rowA?.reachRate}`,
    );

    // === 3. Date filter — лише "сьогодні" за Києвом ===
    const today = kyivDateOnly(now);
    const todayReports = await dashboard.getCampaignReports(workspace.id, { from: today, to: today });
    const rowAToday = todayReports.find((r) => r.id === campaignA.id);
    check('З фільтром "сьогодні" clicks=2 (клік 10 днів тому відсічено)', rowAToday?.clicks === 2, `отримали ${rowAToday?.clicks}`);
    check('З фільтром "сьогодні" reached=1', rowAToday?.reached === 1, `отримали ${rowAToday?.reached}`);

    const noArgsReports = await dashboard.getCampaignReports(workspace.id);
    check(
      'Виклик БЕЗ from/to (старий виклик з одним аргументом) — поведінка як була, clicks=3',
      noArgsReports.find((r) => r.id === campaignA.id)?.clicks === 3,
    );

    // === 4. Channel filter ===
    const channel1Reports = await dashboard.getCampaignReports(workspace.id, { channelId: channel1.id });
    check(
      'channelId=channel1 повертає A і B, без X з іншого каналу',
      channel1Reports.some((r) => r.id === campaignA.id) &&
        channel1Reports.some((r) => r.id === campaignB.id) &&
        channel1Reports.every((r) => r.id !== campaignX.id),
      `отримали id: ${channel1Reports.map((r) => r.id).join(', ')}`,
    );
    const channel2Reports = await dashboard.getCampaignReports(workspace.id, { channelId: channel2.id });
    check(
      'channelId=channel2 повертає лише Campaign X',
      channel2Reports.length === 1 && channel2Reports[0]?.id === campaignX.id,
      `отримали id: ${channel2Reports.map((r) => r.id).join(', ')}`,
    );
  } finally {
    // Підчищаємо за собою в порядку залежностей — так само, як qa:smoke-tracking.
    await prisma.unsubscribeEvent.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.attribution.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.subscriberProfile.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.membershipEvent.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.clickEvent.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.trackingLink.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.campaign.deleteMany({ where: { workspaceId: workspace.id } });
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
