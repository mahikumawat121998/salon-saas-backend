import { Controller, Post, Body, Get, Param, Patch, Delete } from "@nestjs/common";
import { StaffService } from "./staff.service";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UpdateStaffDto } from "./dto/update-staff.dto";

@Controller("staff")
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Post()
  createStaff(@Body() dto: CreateStaffDto, @CurrentUser() user: any) {
    return this.staffService.create(dto, user.tenantId);
  }
  @Get()
  getStaff(@CurrentUser() user: any) {
    return this.staffService.findAll(user.tenantId);
  }
  @Get(":id")
  getStaffById(
    @Param("id") id: string,

    @CurrentUser() user: any,
  ) {
    return this.staffService.findOne(id, user.tenantId);
  }
  @Patch(":id")
  updateStaff(
    @Param("id") id: string,

    @Body() dto: UpdateStaffDto,

    @CurrentUser() user: any,
  ) {
    return this.staffService.update(id, user.tenantId, dto);
  }
  @Delete(":id")
  deleteStaff(
    @Param("id") id: string,

    @CurrentUser() user: any,
  ) {
    return this.staffService.remove(id, user.tenantId);
  }
}
