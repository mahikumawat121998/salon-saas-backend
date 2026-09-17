import { Module } from '@nestjs/common';
import { AttendanceService } from './services/attendance.service';
import { AttendancePolicyService } from './services/attendance-policy.service';
import { AttendanceController } from './controllers/attendance.controller';
import { AttendancePolicyController } from './controllers/attendance-policy.controller';

@Module({
  providers: [AttendanceService, AttendancePolicyService],
  controllers: [AttendanceController, AttendancePolicyController],
})
export class AttendanceModule {}
