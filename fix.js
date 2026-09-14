const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const subscriptions = await prisma.tenantSubscription.findMany({
    include: { plan: true },
  });

  for (const sub of subscriptions) {
    if (sub.plan.monthlyPrice > 0 && sub.status === 'TRIALING') {
      await prisma.tenantSubscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE', trialEndsAt: null },
      });
      console.log(`Updated subscription ${sub.id} to ACTIVE`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
