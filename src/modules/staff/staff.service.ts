import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../common/database/prisma.service";

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async create(dto: any, tenantId: string) {
    return this.prisma.staff.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone,
        profilePicture: dto.profilePicture,
      },
    });
  }
  async findAll(tenantId: string) {
    return this.prisma.staff.findMany({
      where: {
        tenantId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  }
  async findOne(id: string, tenantId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        id,
        tenantId,
      },

      include: {
        schedules: true,
        breaks: true,
        leaves: true,
      },
    });

    if (!staff) {
      throw new NotFoundException("Staff not found");
    }

    return staff;
  }
  async update(id: string, tenantId: string, dto: any) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!staff) {
      throw new NotFoundException("Staff not found");
    }

    return this.prisma.staff.update({
      where: {
        id: staff.id,
      },

      data: dto,
    });
  }
  async remove(id: string, tenantId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!staff) {
      throw new NotFoundException("Staff not found");
    }

    return this.prisma.staff.delete({
      where: {
        id: staff.id,
      },
    });
  }
}
