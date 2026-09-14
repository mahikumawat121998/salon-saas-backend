import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { StaffScheduleService } from "./staff-schedule.service";
import { SetWeeklyScheduleDto } from "./dto/create-schedule.dto";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { RequirePermission } from "../../../common/decorators/permission.decorator";
import { ApiMessage } from "../../../common/decorators/api-message.decorator";

@Controller("staff")
export class StaffScheduleController {
  constructor(private readonly staffScheduleService: StaffScheduleService) {}

  @Put(":staffId/schedules")
  @RequirePermission("STAFF_UPDATE")
  @ApiMessage("Weekly schedule updated successfully")
  setSchedule(
    @Param("staffId") staffId: string,
    @Body() dto: SetWeeklyScheduleDto,
    @CurrentUser() user: any,
  ) {
    return this.staffScheduleService.setWeeklySchedule(staffId, user.tenantId, dto);
  }

  @Get(":staffId/schedules")
  @RequirePermission("STAFF_VIEW")
  @ApiMessage("Staff weekly schedule fetched successfully")
  getSchedule(@Param("staffId") staffId: string, @CurrentUser() user: any) {
    return this.staffScheduleService.getStaffSchedule(staffId, user.tenantId);
  }
}
