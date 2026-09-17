import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.staffAttendance.findMany().then(res => console.log(res)).catch(err => console.error(err)).finally(() => prisma.$disconnect());
