import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_EMAIL = process.env.STAGING_LOGIN_EMAIL ?? 'test@cleartg.ua';
const AGENCY_EMAIL = process.env.AGENCY_ADMIN_EMAIL ?? 'agency@cleartg.ua';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3002';

async function main() {
  const clientUser = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    create: {
      email: TEST_EMAIL,
      name: 'Test Client',
      emailVerified: true,
    },
    update: { emailVerified: true },
  });

  const agencyUser = await prisma.user.upsert({
    where: { email: AGENCY_EMAIL },
    create: {
      email: AGENCY_EMAIL,
      name: 'Agency Admin',
      emailVerified: true,
    },
    update: { emailVerified: true },
  });

  const clientWorkspace = await prisma.workspace.upsert({
    where: { slug: 'main' },
    create: {
      name: 'Кабінет клієнта (demo)',
      slug: 'main',
      privacyPolicyUrl: `${APP_URL}/privacy`,
      members: {
        create: [
          { userId: clientUser.id, role: 'OWNER' },
          { userId: agencyUser.id, role: 'ADMIN' },
        ],
      },
    },
    update: {
      privacyPolicyUrl: `${APP_URL}/privacy`,
      name: 'Кабінет клієнта (demo)',
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: clientWorkspace.id,
        userId: clientUser.id,
      },
    },
    create: { workspaceId: clientWorkspace.id, userId: clientUser.id, role: 'OWNER' },
    update: { role: 'OWNER' },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: clientWorkspace.id,
        userId: agencyUser.id,
      },
    },
    create: { workspaceId: clientWorkspace.id, userId: agencyUser.id, role: 'ADMIN' },
    update: { role: 'ADMIN' },
  });

  console.log('Seed complete:', {
    client: clientUser.email,
    agency: agencyUser.email,
    workspace: clientWorkspace.slug,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
