import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/database/prisma.service";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";
import { CreatePricingDto } from "./dto/create-pricing.dto";
import { UpdatePricingDto } from "./dto/update-pricing.dto";

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async createCategory(dto: any, tenantId: string) {
    return this.prisma.serviceCategory.create({
      data: {
        tenantId,
        name: dto.name,
      },
    });
  }
  async findCategories(tenantId: string) {
    return this.prisma.serviceCategory.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
  async updateCategory(tenantId: string, id: string, dto: any) {
    return this.prisma.serviceCategory.update({
      where: { id, tenantId },
      data: { name: dto.name },
    });
  }
  async deleteCategory(tenantId: string, id: string) {
    return this.prisma.serviceCategory.delete({
      where: { id, tenantId },
    });
  }
  async createService(tenantId: string, dto: CreateServiceDto) {
    const { categoryId, name, image, durationMinutes, price, tax, status, commissionRule, eligibleStaffIds } = dto;
    return this.prisma.service.create({
      data: {
        tenantId,
        categoryId,
        name,
        image,
        durationMinutes,
        price,
        tax,
        status,
        commissionRule,
        ...(eligibleStaffIds && eligibleStaffIds.length > 0 && {
          staff: {
            create: eligibleStaffIds.map((staffId) => ({ staffId })),
          },
        }),
      },
      include: {
        staff: true,
      }
    });
  }
  async findServices(tenantId: string) {
    return this.prisma.service.findMany({
      where: {
        tenantId,
      },
      include: {
        category: true,
        staff: true,
      },
      orderBy: {
        name: "asc"
      }
    });
  }
  async findServiceById(tenantId: string, id: string) {
    return this.prisma.service.findUnique({
      where: { id, tenantId },
      include: {
        category: true,
        staff: true,
      },
    });
  }
  async updateService(tenantId: string, id: string, dto: UpdateServiceDto) {
    const { eligibleStaffIds, ...updateData } = dto;
    
    // Update basic service fields
    const updatedService = await this.prisma.service.update({
      where: { id, tenantId },
      data: updateData,
    });

    // If eligibleStaffIds is provided, sync the relations
    if (eligibleStaffIds !== undefined) {
      // First delete all existing associations for this service
      await this.prisma.staffService.deleteMany({
        where: { serviceId: id },
      });

      // Then create the new ones
      if (eligibleStaffIds.length > 0) {
        await this.prisma.staffService.createMany({
          data: eligibleStaffIds.map(staffId => ({ staffId, serviceId: id })),
        });
      }
    }

    return this.prisma.service.findUnique({
      where: { id, tenantId },
      include: { staff: true, category: true },
    });
  }
  async deleteService(tenantId: string, id: string) {
    return this.prisma.service.delete({
      where: {
        id,
        tenantId,
      },
    });
  }
  async createPricing(tenantId: string, dto: CreatePricingDto) {
    return this.prisma.pricing.create({
      data: {
        tenantId,
        serviceId: dto.serviceId,
        price: dto.price,
      },
    });
  }
  async findPricing(tenantId: string, serviceId: string) {
    return this.prisma.pricing.findMany({
      where: {
        tenantId,
        serviceId,
      },
      include: {
        service: true,
      },
    });
  }
  async updatePricing(tenantId: string, id: string, dto: UpdatePricingDto) {
    return this.prisma.pricing.update({
      where: {
        id,
        tenantId,
      },
      data: dto,
    });
  }
  async deletePricing(tenantId: string, id: string) {
    return this.prisma.pricing.delete({
      where: {
        id,
        tenantId,
      },
    });
  }
}
