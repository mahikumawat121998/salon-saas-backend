import { Controller, Post, Body, Get, Req, Patch, Param, Delete } from "@nestjs/common";

import { CatalogService } from "./catalog.service";

import { CreateCategoryDto } from "./dto/create-category.dto";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";
import { CreatePricingDto } from "./dto/create-pricing.dto";
import { UpdatePricingDto } from "./dto/update-pricing.dto";
@Controller("catalog")
export class CatalogController {
  constructor(private catalogService: CatalogService) {}

  @Post("categories")
  createCategory(
    @Body() dto: CreateCategoryDto,

    @CurrentUser() user: any,
  ) {
    return this.catalogService.createCategory(dto, user.tenantId);
  }

  @Get("categories")
  findCategories(@Req() req: any) {
    return this.catalogService.findCategories(req.user.tenantId);
  }
  @Patch("categories/:id")
  updateCategory(@Req() req: any, @Param("id") id: string, @Body() dto: any) {
    return this.catalogService.updateCategory(req.user.tenantId, id, dto);
  }
  @Delete("categories/:id")
  deleteCategory(@Req() req: any, @Param("id") id: string) {
    return this.catalogService.deleteCategory(req.user.tenantId, id);
  }
  @Post("services")
  createService(@Req() req: any, @Body() dto: CreateServiceDto) {
    return this.catalogService.createService(req.user.tenantId, dto);
  }
  @Get("services")
  findServices(@Req() req: any) {
    return this.catalogService.findServices(req.user.tenantId);
  }
  @Get("services/:id")
  findServiceById(@Req() req: any, @Param("id") id: string) {
    return this.catalogService.findServiceById(req.user.tenantId, id);
  }
  @Patch("services/:id")
  updateService(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateServiceDto) {
    return this.catalogService.updateService(req.user.tenantId, id, dto);
  }
  @Delete("services/:id")
  deleteService(@Req() req: any, @Param("id") id: string) {
    return this.catalogService.deleteService(req.user.tenantId, id);
  }
  @Post("pricing")
  createPricing(@Req() req: any, @Body() dto: CreatePricingDto) {
    return this.catalogService.createPricing(req.user.tenantId, dto);
  }
  @Get("pricing/:serviceId")
  findPricing(@Req() req: any, @Param("serviceId") serviceId: string) {
    return this.catalogService.findPricing(req.user.tenantId, serviceId);
  }
  @Patch("pricing/:id")
  updatePricing(@Req() req: any, @Param("id") id: string, @Body() dto: UpdatePricingDto) {
    return this.catalogService.updatePricing(req.user.tenantId, id, dto);
  }
  @Delete("pricing/:id")
  deletePricing(@Req() req: any, @Param("id") id: string) {
    return this.catalogService.deletePricing(req.user.tenantId, id);
  }
}
