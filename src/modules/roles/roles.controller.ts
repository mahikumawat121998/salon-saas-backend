import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { RolesService } from "./roles.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AssignUserRolesDto } from "./dto/assign-role.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ApiMessage } from "../../common/decorators/api-message.decorator";

@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get("permissions")
  @ApiMessage("Available permissions fetched successfully")
  getAllPermissions() {
    return this.rolesService.getAllPermissions();
  }

  @Post()
  @ApiMessage("Role created successfully")
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: any) {
    return this.rolesService.createRole(user.tenantId, dto);
  }

  @Get()
  @ApiMessage("Roles fetched successfully")
  findAllRoles(@CurrentUser() user: any) {
    return this.rolesService.findAllRoles(user.tenantId);
  }

  @Get("user/:userId")
  @ApiMessage("User roles fetched successfully")
  getUserRoles(@Param("userId") userId: string, @CurrentUser() user: any) {
    return this.rolesService.getUserRoles(userId, user.tenantId);
  }

  @Get(":id")
  @ApiMessage("Role details fetched successfully")
  findOneRole(@Param("id") id: string, @CurrentUser() user: any) {
    return this.rolesService.findOneRole(id, user.tenantId);
  }

  @Patch(":id")
  @ApiMessage("Role updated successfully")
  updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: any,
  ) {
    return this.rolesService.updateRole(id, user.tenantId, dto);
  }

  @Delete(":id")
  @ApiMessage("Role deleted successfully")
  deleteRole(@Param("id") id: string, @CurrentUser() user: any) {
    return this.rolesService.deleteRole(id, user.tenantId);
  }

  @Post("assign-user")
  @ApiMessage("User roles assigned successfully")
  assignRolesToUser(@Body() dto: AssignUserRolesDto, @CurrentUser() user: any) {
    return this.rolesService.assignRolesToUser(user.tenantId, dto);
  }
}
