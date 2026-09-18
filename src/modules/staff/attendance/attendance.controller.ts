import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { StaffAttendanceService } from "./attendance.service";
import { ClockInDto, ClockOutDto, MarkAbsentDto } from "./dto/attendance.dto";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { RequirePermission } from "../../../common/decorators/permission.decorator";
import { ApiMessage } from "../../../common/decorators/api-message.decorator";

@Controller("staff")
export class StaffAttendanceController {
  constructor(private readonly attendanceService: StaffAttendanceService) {}

  @Get("attendance")
  @RequirePermission("STAFF_VIEW")
  @ApiMessage("Attendance records fetched successfully")
  getAttendanceByDate(@Query("date") dateStr: string, @CurrentUser() user: any) {
    // default to today if no date provided
    const date = dateStr || new Date().toISOString().split("T")[0];
    return this.attendanceService.getAttendanceByDate(user.tenantId, date);
  }

  @Post(":staffId/attendance/clock-in")
  @RequirePermission("STAFF_UPDATE")
  @ApiMessage("Staff clocked in successfully")
  clockIn(
    @Param("staffId") staffId: string,
    @Body() dto: ClockInDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.clockIn(staffId, user.tenantId, dto);
  }

  @Post(":staffId/attendance/clock-out")
  @RequirePermission("STAFF_UPDATE")
  @ApiMessage("Staff clocked out successfully")
  clockOut(
    @Param("staffId") staffId: string,
    @Body() dto: ClockOutDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.clockOut(staffId, user.tenantId, dto);
  }

  @Post(":staffId/attendance/mark-absent")
  @RequirePermission("STAFF_UPDATE")
  @ApiMessage("Staff marked as absent successfully")
  markAbsent(
    @Param("staffId") staffId: string,
    @Body() dto: MarkAbsentDto,
    @CurrentUser() user: any,
  ) {
    return this.attendanceService.markAbsent(staffId, user.tenantId, dto);
  }
}
