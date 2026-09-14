const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({
      where: { email: 'shubhamkumawat121998@gmail.com' },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        tenant: {
          include: {
            subscription: {
              include: {
                plan: true,
              },
            },
          },
        },
      },
    });

    let tenantModules = ["APPOINTMENTS", "CUSTOMERS", "CATALOG", "STAFF", "BILLING"];
    if (user.tenant?.subscription) {
       tenantModules = user.tenant.subscription.customAllowedModules && user.tenant.subscription.customAllowedModules.length > 0
         ? user.tenant.subscription.customAllowedModules
         : user.tenant.subscription.plan?.allowedModules || [];
    }
    
    console.log("tenantModules:", tenantModules);
}
main().catch(console.error).finally(() => prisma.$disconnect());
