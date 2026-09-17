import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'owner@urbancuts.com' }, include: { tenant: true } });
  console.log(user);
}
main().finally(() => prisma.$disconnect());
