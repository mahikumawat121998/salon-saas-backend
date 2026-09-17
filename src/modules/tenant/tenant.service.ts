import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import * as bcrypt from "bcrypt";

import { PrismaService } from "../../common/database/prisma.service";

import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantSettingsDto } from "./dto/update-tenant-settings.dto";

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: dto.ownerEmail,
      },
    });

    if (existingUser) {
      throw new BadRequestException("Owner email already exists");
    }

    const ownerRole = await this.prisma.role.findFirst({
      where: {
        name: "OWNER",
      },
    });

    if (!ownerRole) {
      throw new BadRequestException("OWNER role not found");
    }

    const passwordHash = await bcrypt.hash(dto.ownerPassword, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,

          settings: {
            create: {
              timezone: dto.timezone ?? "UTC",

              currency: dto.currency ?? "INR",
            },
          },
        },
      });

      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,

          email: dto.ownerEmail,

          passwordHash,

          roles: {
            create: {
              roleId: ownerRole.id,
            },
          },
        },
      });

      return {
        tenant,
        owner,
      };
    });

    return {
      message: "Tenant created successfully",

      data: result,
    };
  }

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true },
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return tenant;
  }

  async updateSettings(tenantId: string, dto: UpdateTenantSettingsDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.name || dto.logo !== undefined) {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { 
            ...(dto.name && { name: dto.name }),
            ...(dto.logo !== undefined && { logo: dto.logo })
          },
        });
      }

      if (dto.timezone !== undefined || dto.currency !== undefined) {
        await tx.tenantSettings.upsert({
          where: { tenantId },
          create: {
            tenantId,
            timezone: dto.timezone ?? "UTC",
            currency: dto.currency ?? "INR",
          },
          update: {
            ...(dto.timezone && { timezone: dto.timezone }),
            ...(dto.currency && { currency: dto.currency }),
          },
        });
      }

      return tx.tenant.findUnique({
        where: { id: tenantId },
        include: { settings: true },
      });
    });
  }

  async getBusinessHours(tenantId: string) {
    const existing = await this.prisma.tenantBusinessHour.findMany({
      where: { tenantId },
      orderBy: { dayOfWeek: "asc" },
    });

    if (existing.length === 7) {
      return existing;
    }

    // Default 7 days template if missing
    const defaultHours = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
      const found = existing.find((item) => item.dayOfWeek === dayOfWeek);
      if (found) return found;
      return {
        tenantId,
        dayOfWeek,
        openTime: "09:00",
        closeTime: "21:00",
        isOpen: dayOfWeek !== 0, // Sunday closed by default if not set
      };
    });

    return defaultHours;
  }

  async updateBusinessHours(tenantId: string, hours: any[]) {
    const operations = hours.map((item) =>
      this.prisma.tenantBusinessHour.upsert({
        where: {
          tenantId_dayOfWeek: {
            tenantId,
            dayOfWeek: item.dayOfWeek,
          },
        },
        update: {
          openTime: item.openTime,
          closeTime: item.closeTime,
          isOpen: item.isOpen,
        },
        create: {
          tenantId,
          dayOfWeek: item.dayOfWeek,
          openTime: item.openTime,
          closeTime: item.closeTime,
          isOpen: item.isOpen,
        },
      })
    );

    await this.prisma.$transaction(operations);

    return this.getBusinessHours(tenantId);
  }
}
