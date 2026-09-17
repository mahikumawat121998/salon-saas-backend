import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { StaffLeaveService } from "./staff-leave.service";
import { CreateLeaveDto } from "./dto/create-leave.dto";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { RequirePermission } from "../../../common/decorators/permission.decorator";
import { ApiMessage } from "../../../common/decorators/api-message.decorator";

@Controller("staff")
export class StaffLeaveController {
  constructor(private readonly staffLeaveService: StaffLeaveService) {}

  @Get("leaves")
  @RequirePermission("STAFF_VIEW")
  @ApiMessage("All staff leaves fetched successfully")
  getAllLeaves(@CurrentUser() user: any) {
    return this.staffLeaveService.getAllLeaves(user.tenantId);
  }

  @Post(":staffId/leaves")
  @RequirePermission("STAFF_UPDATE")
  @ApiMessage("Staff leave requested successfully")
  createLeave(
    @Param("staffId") staffId: string,
    @Body() dto: CreateLeaveDto,
    @CurrentUser() user: any,
  ) {
    return this.staffLeaveService.createLeave(staffId, user.tenantId, dto);
  }

  @Get(":staffId/leaves")
  @RequirePermission("STAFF_VIEW")
  @ApiMessage("Staff leaves fetched successfully")
  getLeaves(@Param("staffId") staffId: string, @CurrentUser() user: any) {
    return this.staffLeaveService.getLeaves(staffId, user.tenantId);
  }

  @Delete("leaves/:leaveId")
  @RequirePermission("STAFF_UPDATE")
  @ApiMessage("Staff leave deleted successfully")
  deleteLeave(@Param("leaveId") leaveId: string, @CurrentUser() user: any) {
    return this.staffLeaveService.deleteLeave(leaveId, user.tenantId);
  }
}
