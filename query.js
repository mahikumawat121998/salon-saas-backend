const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'owner@urbancuts.com' },
    include: {
      tenant: {
        include: {
          subscription: {
            include: {
              plan: true
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(user?.tenant?.subscription, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
