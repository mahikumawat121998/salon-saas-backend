import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { name: 'Urban Cuts' } });
  if (!tenant) throw new Error('Tenant not found');

  const staffList = await prisma.staff.findMany({ where: { tenantId: tenant.id } });
  if (staffList.length === 0) throw new Error('No staff found');

  console.log(`Found ${staffList.length} staff members.`);

  // Create Payroll Period for August 2026
  const augustStart = new Date('2026-08-01T00:00:00Z');
  const augustEnd = new Date('2026-08-31T23:59:59Z');
  
  const existingPeriod = await prisma.payrollPeriod.findFirst({
    where: { tenantId: tenant.id, name: 'August 2026' }
  });

  if (existingPeriod) {
    console.log('Payroll period already exists, deleting it to recreate...');
    await prisma.payrollPeriod.delete({ where: { id: existingPeriod.id } });
  }

  const period = await prisma.payrollPeriod.create({
    data: {
      tenantId: tenant.id,
      name: 'August 2026',
      startDate: augustStart,
      endDate: augustEnd,
      workingDaysCount: 26,
      status: 'APPROVED',
      totalGrossPay: 0,
      totalDeductions: 0,
      totalNetPay: 0,
    }
  });

  console.log(`Created Payroll Period: ${period.name}`);

  let totalPeriodGross = 0;
  let totalPeriodDeductions = 0;
  let totalPeriodNet = 0;

  for (const staff of staffList) {
    const baseEarned = 30000 + Math.floor(Math.random() * 10000);
    const serviceCommission = 2000 + Math.floor(Math.random() * 5000);
    const productCommission = 500 + Math.floor(Math.random() * 1000);
    const bonusAmount = (Math.random() < 0.3) ? 1000 : 0;
    
    const grossPay = baseEarned + serviceCommission + productCommission + bonusAmount;
    
    const leaveDeduction = (Math.random() < 0.4) ? 1200 : 0;
    const statutoryDeductionsTotal = 1500;
    const totalDeductions = leaveDeduction + statutoryDeductionsTotal;
    
    const netPay = grossPay - totalDeductions;

    totalPeriodGross += grossPay;
    totalPeriodDeductions += totalDeductions;
    totalPeriodNet += netPay;

    await prisma.payslip.create({
      data: {
        tenantId: tenant.id,
        payrollPeriodId: period.id,
        staffId: staff.id,
        payStructureType: 'MONTHLY',
        baseEarned,
        serviceCommission,
        productCommission,
        allowancesTotal: 0,
        bonusAmount,
        grossPay,
        leaveDeduction,
        otherDeductionsTotal: 0,
        statutoryDeductionsTotal,
        totalDeductions,
        netPay,
        status: 'PAID',
      }
    });
  }

  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: {
      totalGrossPay: totalPeriodGross,
      totalDeductions: totalPeriodDeductions,
      totalNetPay: totalPeriodNet,
    }
  });

  // Create another period for September (Draft)
  const sepStart = new Date('2026-09-01T00:00:00Z');
  const sepEnd = new Date('2026-09-30T23:59:59Z');
  
  await prisma.payrollPeriod.create({
    data: {
      tenantId: tenant.id,
      name: 'September 2026',
      startDate: sepStart,
      endDate: sepEnd,
      workingDaysCount: 26,
      status: 'DRAFT',
      totalGrossPay: 0,
      totalDeductions: 0,
      totalNetPay: 0,
    }
  });

  console.log(`Created 2 Payroll Periods and populated Payslips for ${staffList.length} staff!`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
