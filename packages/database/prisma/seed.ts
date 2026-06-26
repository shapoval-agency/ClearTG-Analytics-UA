import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_EMAIL = process.env.STAGING_LOGIN_EMAIL ?? 'test@cleartg.ua';

async function main() {
  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    create: {
      email: TEST_EMAIL,
      name: 'Test Admin',
      emailVerified: true,
    },
    update: { emailVerified: true },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'main' },
    create: {
      name: 'Мій workspace',
      slug: 'main',
      privacyPolicyUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/privacy`,
      members: { create: { userId: user.id, role: 'OWNER' } },
    },
    update: {
      privacyPolicyUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/privacy`,
    },
  });

  console.log('Seed complete:', { user: user.email, workspace: workspace.slug });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
