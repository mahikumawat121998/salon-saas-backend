import { Module } from "@nestjs/common";

import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";
import { StaffScheduleController } from "./schedules/staff-schedule.controller";
import { StaffScheduleService } from "./schedules/staff-schedule.service";
import { StaffBreakController } from "./breaks/staff-break.controller";
import { StaffBreakService } from "./breaks/staff-break.service";
import { StaffLeaveController } from "./leaves/staff-leave.controller";
import { StaffLeaveService } from "./leaves/staff-leave.service";
import { StaffAttendanceController } from "./attendance/attendance.controller";
import { StaffAttendanceService } from "./attendance/attendance.service";

@Module({
  controllers: [
    StaffScheduleController,
    StaffBreakController,
    StaffLeaveController,
    StaffAttendanceController,
    StaffController,
  ],

  providers: [
    StaffService,
    StaffScheduleService,
    StaffBreakService,
    StaffLeaveService,
    StaffAttendanceService,
  ],

  exports: [
    StaffService,
    StaffScheduleService,
    StaffBreakService,
    StaffLeaveService,
    StaffAttendanceService,
  ],
})
export class StaffModule {}

