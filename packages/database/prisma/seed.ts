import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@cleartg.ua' },
    create: { email: 'demo@cleartg.ua', name: 'Demo Admin', emailVerified: true },
    update: {},
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo' },
    create: {
      id: 'demo',
      name: 'Demo Workspace',
      slug: 'demo',
      privacyPolicyUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/privacy`,
      members: { create: { userId: user.id, role: 'OWNER' } },
    },
    update: {
      privacyPolicyUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/privacy`,
    },
  });

  const channel = await prisma.channel.upsert({
    where: { workspaceId_telegramChatId: { workspaceId: workspace.id, telegramChatId: '-1001234567890' } },
    create: {
      workspaceId: workspace.id,
      telegramChatId: '-1001234567890',
      title: 'Demo Channel UA',
      username: 'demo_channel_ua',
      botIsAdmin: true,
    },
    update: {},
  });

  const campaign = await prisma.campaign.upsert({
    where: { id: 'demo-campaign-1' },
    create: {
      id: 'demo-campaign-1',
      workspaceId: workspace.id,
      channelId: channel.id,
      name: 'Meta Ads — Літо 2025',
      source: 'meta',
      medium: 'cpc',
      adPlatform: 'META',
      spendModel: 'CPC',
      spendAmount: 5000,
    },
    update: {},
  });

  const link = await prisma.trackingLink.upsert({
    where: { slug: 'demo123' },
    create: {
      workspaceId: workspace.id,
      channelId: channel.id,
      campaignId: campaign.id,
      slug: 'demo123',
      name: 'Demo Meta (auto-redirect)',
      linkMode: 'LANDING_PAGE',
      landingTitle: 'Demo Channel UA',
      landingDescription: 'Підпишіться на наш Telegram-канал з корисним контентом для України.',
      destinationMode: 'INVITE_LINK',
      autoRedirect: true,
      redirectDelayMs: 0,
      usePerClickInvite: true,
      landingPostUrl: 'https://t.me/demo_channel_ua',
      utmSource: 'meta',
      utmMedium: 'cpc',
      utmCampaign: 'summer2025',
    },
    update: {
      linkMode: 'LANDING_PAGE',
      destinationMode: 'INVITE_LINK',
      autoRedirect: true,
      redirectDelayMs: 0,
      usePerClickInvite: true,
    },
  });

  const organicLink = await prisma.trackingLink.upsert({
    where: { slug: 'organic-demo' },
    create: {
      workspaceId: workspace.id,
      channelId: channel.id,
      slug: 'organic-demo',
      name: 'Demo Shortlink (Organic)',
      linkMode: 'SHORTLINK',
      destinationMode: 'PUBLIC_POST',
      autoRedirect: true,
      redirectDelayMs: 0,
      usePerClickInvite: false,
      landingPostUrl: 'https://t.me/demo_channel_ua',
      utmSource: 'organic',
      utmMedium: 'social',
    },
    update: { linkMode: 'SHORTLINK', autoRedirect: true },
  });

  console.log('Seed complete:', {
    workspace: workspace.id,
    channel: channel.id,
    landingLink: link.slug,
    shortlink: organicLink.slug,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
