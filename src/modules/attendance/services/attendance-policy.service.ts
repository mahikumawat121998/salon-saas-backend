import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/database/prisma.service';

@Injectable()
export class AttendancePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getPolicy(tenantId: string) {
    let policy = await this.prisma.tenantAttendancePolicy.findUnique({
      where: { tenantId },
    });

    if (!policy) {
      // Create default policy if it doesn't exist
      policy = await this.prisma.tenantAttendancePolicy.create({
        data: { tenantId },
      });
    }

    return policy;
  }

  async updatePolicy(tenantId: string, data: any) {
    return this.prisma.tenantAttendancePolicy.upsert({
      where: { tenantId },
      create: { ...data, tenantId },
      update: data,
    });
  }
}
