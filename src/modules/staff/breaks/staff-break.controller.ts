import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { StaffBreakService } from "./staff-break.service";
import { CreateBreakDto } from "./dto/create-break.dto";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { RequirePermission } from "../../../common/decorators/permission.decorator";
import { ApiMessage } from "../../../common/decorators/api-message.decorator";

@Controller("staff")
export class StaffBreakController {
  constructor(private readonly staffBreakService: StaffBreakService) {}

  @Post(":staffId/breaks")
  @RequirePermission("STAFF_UPDATE")
  @ApiMessage("Staff break added successfully")
  createBreak(
    @Param("staffId") staffId: string,
    @Body() dto: CreateBreakDto,
    @CurrentUser() user: any,
  ) {
    return this.staffBreakService.createBreak(staffId, user.tenantId, dto);
  }

  @Get(":staffId/breaks")
  @RequirePermission("STAFF_VIEW")
  @ApiMessage("Staff breaks fetched successfully")
  getBreaks(@Param("staffId") staffId: string, @CurrentUser() user: any) {
    return this.staffBreakService.getBreaks(staffId, user.tenantId);
  }

  @Delete("breaks/:breakId")
  @RequirePermission("STAFF_UPDATE")
  @ApiMessage("Staff break deleted successfully")
  deleteBreak(@Param("breakId") breakId: string, @CurrentUser() user: any) {
    return this.staffBreakService.deleteBreak(breakId, user.tenantId);
  }
}
