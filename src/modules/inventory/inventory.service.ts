import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, createInventoryDto: CreateInventoryDto) {
    return this.prisma.inventoryProduct.create({
      data: {
        ...createInventoryDto,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.inventoryProduct.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.inventoryProduct.findUnique({
      where: { id, tenantId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(tenantId: string, id: string, updateInventoryDto: UpdateInventoryDto) {
    await this.findOne(tenantId, id); // check existence
    return this.prisma.inventoryProduct.update({
      where: { id, tenantId },
      data: updateInventoryDto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id); // check existence
    return this.prisma.inventoryProduct.delete({
      where: { id, tenantId },
    });
  }
}
