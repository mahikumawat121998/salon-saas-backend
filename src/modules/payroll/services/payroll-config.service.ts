import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/database/prisma.service";
import { CreateSalaryConfigDto } from "../dto/create-salary-config.dto";

@Injectable()
export class PayrollConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getStaffConfigs(tenantId: string) {
    const staffMembers = await this.prisma.staff.findMany({
      where: { tenantId },
      include: {
        salaryConfig: {
          include: {
            components: true,
            commissionRules: { include: { tiers: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return staffMembers.map((s) => ({
      staffId: s.id,
      staffName: s.name,
      phone: s.phone,
      status: s.status,
      salaryConfig: s.salaryConfig,
    }));
  }

  async getStaffConfigById(tenantId: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
      include: {
        salaryConfig: {
          include: {
            components: true,
            commissionRules: { include: { tiers: true } },
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException("Staff member not found");
    }

    return {
      staffId: staff.id,
      staffName: staff.name,
      phone: staff.phone,
      status: staff.status,
      salaryConfig: staff.salaryConfig,
    };
  }

  async upsertSalaryConfig(tenantId: string, staffId: string, dto: CreateSalaryConfigDto, actorUserId?: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
    });

    if (!staff) {
      throw new NotFoundException("Staff member not found");
    }

    // Use transaction to update config, components, and rules
    const result = await this.prisma.$transaction(async (tx) => {
      let config = await tx.staffSalaryConfig.findUnique({ where: { staffId } });

      if (config) {
        config = await tx.staffSalaryConfig.update({
          where: { staffId },
          data: {
            payStructureType: dto.payStructureType,
            baseSalary: dto.baseSalary ?? 0,
            dailyRate: dto.dailyRate ?? 0,
            hourlyRate: dto.hourlyRate ?? 0,
            overtimeRatePerHour: dto.overtimeRatePerHour ?? 0,
            overtimeMultiplier: dto.overtimeMultiplier ?? 1.5,
          },
        });
      } else {
        config = await tx.staffSalaryConfig.create({
          data: {
            tenantId,
            staffId,
            payStructureType: dto.payStructureType,
            baseSalary: dto.baseSalary ?? 0,
            dailyRate: dto.dailyRate ?? 0,
            hourlyRate: dto.hourlyRate ?? 0,
            overtimeRatePerHour: dto.overtimeRatePerHour ?? 0,
            overtimeMultiplier: dto.overtimeMultiplier ?? 1.5,
          },
        });
      }

      // Re-create components
      await tx.staffSalaryComponentConfig.deleteMany({ where: { salaryConfigId: config.id } });
      if (dto.components && dto.components.length > 0) {
        await tx.staffSalaryComponentConfig.createMany({
          data: dto.components.map((c) => ({
            salaryConfigId: config.id,
            name: c.name,
            type: c.type,
            calculationType: c.calculationType,
            value: c.value,
            isTaxable: c.isTaxable ?? true,
          })),
        });
      }

      // Re-create commission rules & tiers
      const existingRules = await tx.staffCommissionRule.findMany({ where: { salaryConfigId: config.id } });
      for (const r of existingRules) {
        await tx.staffCommissionTier.deleteMany({ where: { commissionRuleId: r.id } });
      }
      await tx.staffCommissionRule.deleteMany({ where: { salaryConfigId: config.id } });

      if (dto.commissionRules && dto.commissionRules.length > 0) {
        for (const ruleDto of dto.commissionRules) {
          const rule = await tx.staffCommissionRule.create({
            data: {
              salaryConfigId: config.id,
              type: ruleDto.type,
              calcMode: ruleDto.calcMode,
              flatRate: ruleDto.flatRate ?? 0,
            },
          });

          if (ruleDto.tiers && ruleDto.tiers.length > 0) {
            await tx.staffCommissionTier.createMany({
              data: ruleDto.tiers.map((t) => ({
                commissionRuleId: rule.id,
                minRevenueVolume: t.minRevenueVolume,
                maxRevenueVolume: t.maxRevenueVolume ?? null,
                commissionRate: t.commissionRate,
              })),
            });
          }
        }
      }

      return tx.staffSalaryConfig.findUnique({
        where: { id: config.id },
        include: {
          components: true,
          commissionRules: { include: { tiers: true } },
        },
      });
    });

    // Record Audit Log
    if (actorUserId) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          targetTenantId: tenantId,
          action: "PAYROLL_CONFIG_UPDATED",
          details: `Updated salary config for staff ID ${staffId} (${staff.name})`,
        },
      });
    }

    return result;
  }
}
