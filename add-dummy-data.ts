import { PrismaClient, StaffStatus, AttendanceStatus, BreakType } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { name: 'Urban Cuts' } });
  if (!tenant) throw new Error('Tenant not found');

  // Create extra staff
  const staffNames = ['Priya Sharma', 'Rahul Desai', 'Anita Patel', 'Vikram Singh'];
  const staffIds: string[] = [];
  
  for (const name of staffNames) {
    const staff = await prisma.staff.create({
      data: {
        tenantId: tenant.id,
        name: name,
        phone: `+91 98${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
        status: StaffStatus.ACTIVE
      }
    });
    staffIds.push(staff.id);
  }

  // Don't add Aarav to avoid unique constraint violations
  // const staff1 = await prisma.staff.findFirst({ where: { tenantId: tenant.id, name: 'Aarav Sharma' } });
  // if (staff1) staffIds.push(staff1.id);

  console.log(`Created ${staffIds.length} staff members.`);

  // Seed 14 days of Attendance History for ALL staff members
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let attendanceCount = 0;
  for (const staffId of staffIds) {
    for (let i = 14; i >= 0; i--) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      const dayOfWeek = targetDate.getDay();

      if (dayOfWeek === 0) {
        await prisma.staffAttendance.create({
          data: { tenantId: tenant.id, staffId: staffId, date: targetDate, status: AttendanceStatus.WEEK_OFF, totalHours: 0, workingHours: 0 }
        });
        attendanceCount++;
        continue;
      }

      if (Math.random() < 0.1) {
        await prisma.staffAttendance.create({
          data: { tenantId: tenant.id, staffId: staffId, date: targetDate, status: AttendanceStatus.ABSENT, totalHours: 0, workingHours: 0 }
        });
        attendanceCount++;
        continue;
      }

      if (Math.random() < 0.1) {
        await prisma.staffAttendance.create({
          data: { tenantId: tenant.id, staffId: staffId, date: targetDate, status: AttendanceStatus.ON_LEAVE, totalHours: 0, workingHours: 0 }
        });
        attendanceCount++;
        continue;
      }

      const clockIn = new Date(targetDate);
      clockIn.setUTCHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0); 
      const clockOut = new Date(targetDate);
      clockOut.setUTCHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);

      const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      const breakDurationMinutes = 60;
      const workingHours = totalHours - (breakDurationMinutes / 60);

      const status = (Math.random() < 0.1) ? AttendanceStatus.HALF_DAY : AttendanceStatus.PRESENT;

      const attendance = await prisma.staffAttendance.create({
        data: { tenantId: tenant.id, staffId: staffId, date: targetDate, status, clockIn, clockOut, totalHours, workingHours }
      });
      attendanceCount++;

      const breakStart = new Date(targetDate);
      breakStart.setUTCHours(13, 0, 0, 0);
      const breakEnd = new Date(targetDate);
      breakEnd.setUTCHours(14, 0, 0, 0);

      await prisma.staffAttendanceBreak.create({
        data: { attendanceId: attendance.id, startTime: breakStart, endTime: breakEnd, duration: breakDurationMinutes, type: BreakType.LUNCH }
      });
    }
  }

  console.log(`Created ${attendanceCount} attendance records.`);

  // Seed Leave Requests
  const leaveReasons = ['Family Vacation', 'Sick Leave', 'Personal Work', 'Maternity Leave', 'Attending Wedding'];
  let leaveCount = 0;
  for (let i = 0; i < 15; i++) {
    const randomStaffId = staffIds[Math.floor(Math.random() * staffIds.length)];
    
    // Random start date between 10 days ago and 30 days from now
    const offset = Math.floor(Math.random() * 40) - 10;
    const startAt = new Date();
    startAt.setUTCHours(0, 0, 0, 0);
    startAt.setDate(startAt.getDate() + offset);
    
    const duration = Math.floor(Math.random() * 5) + 1;
    const endAt = new Date(startAt);
    endAt.setDate(startAt.getDate() + duration);

    await prisma.staffLeave.create({
      data: { 
        tenantId: tenant.id, 
        staffId: randomStaffId, 
        startAt, 
        endAt, 
        reason: leaveReasons[Math.floor(Math.random() * leaveReasons.length)] 
      }
    });
    leaveCount++;
  }

  console.log(`Created ${leaveCount} leave records.`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
