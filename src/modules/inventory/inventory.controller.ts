import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlanGuard } from '../../common/guards/plan.guard';
import { RequirePlanModule } from '../../common/decorators/require-plan-module.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PlanGuard)
@RequirePlanModule('INVENTORY')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  create(@Request() req, @Body() createInventoryDto: CreateInventoryDto) {
    return this.inventoryService.create(req.user.tenantId, createInventoryDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.inventoryService.findAll(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.inventoryService.findOne(req.user.tenantId, id);
  }

  @Put(':id')
  update(@Request() req, @Param('id') id: string, @Body() updateInventoryDto: UpdateInventoryDto) {
    return this.inventoryService.update(req.user.tenantId, id, updateInventoryDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.inventoryService.remove(req.user.tenantId, id);
  }
}
