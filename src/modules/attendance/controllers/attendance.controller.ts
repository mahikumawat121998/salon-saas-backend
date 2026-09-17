import { Controller, Get, Post, Query, Param, UseGuards, Body } from '@nestjs/common';
import { AttendanceService } from '../services/attendance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { BreakType } from '@prisma/client';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  async getDailyAttendance(@CurrentUser() user: any, @Query('date') date: string) {
    // default to today if date not provided
    const targetDate = date || new Date().toISOString();
    return this.attendanceService.getDailyAttendance(user.tenantId, targetDate);
  }

  @Post('clock-in')
  async clockIn(@CurrentUser() user: any, @Body('staffId') staffId: string) {
    // If the user is staff, they might clock in themselves. For now, assume payload sends staffId.
    // In a real terminal, the staffId would be determined by a PIN or selected from a list.
    return this.attendanceService.clockIn(user.tenantId, staffId);
  }

  @Post('clock-out')
  async clockOut(@CurrentUser() user: any, @Body('staffId') staffId: string) {
    return this.attendanceService.clockOut(user.tenantId, staffId);
  }

  @Post('break/start')
  async startBreak(@CurrentUser() user: any, @Body() data: { staffId: string; type: BreakType }) {
    return this.attendanceService.startBreak(user.tenantId, data.staffId, data.type);
  }

  @Post('break/end')
  async endBreak(@CurrentUser() user: any, @Body('staffId') staffId: string) {
    return this.attendanceService.endBreak(user.tenantId, staffId);
  }
}
