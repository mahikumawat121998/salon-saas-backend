import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AttendancePolicyService } from '../services/attendance-policy.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/permission.decorator';

@Controller('attendance-policy')
@UseGuards(JwtAuthGuard)
export class AttendancePolicyController {
  constructor(private readonly policyService: AttendancePolicyService) {}

  @Get()
  async getPolicy(@CurrentUser() user: any) {
    return this.policyService.getPolicy(user.tenantId);
  }

  @Put()
  async updatePolicy(@CurrentUser() user: any, @Body() data: any) {
    return this.policyService.updatePolicy(user.tenantId, data);
  }
}
