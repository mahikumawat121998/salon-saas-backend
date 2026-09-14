import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";

import { CustomerService } from "./customer.service";

import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CreateCustomerNoteDto } from "./dto/create-customer-note.dto";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ApiMessage } from "../../common/decorators/api-message.decorator";

@Controller("customers")
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  createCustomer(@CurrentUser() user, @Body() dto: CreateCustomerDto) {
    return this.customerService.create(user.tenantId, dto);
  }

  @Get()
  getCustomers(@CurrentUser() user: any) {
    return this.customerService.findAll(user.tenantId);
  }

  @Get(":id")
  getCustomer(@Param("id") id: string, @CurrentUser() user: any) {
    return this.customerService.findOne(id, user.tenantId);
  }

  @Patch(":id")
  updateCustomer(
    @Param("id") id: string,

    @Body() dto: UpdateCustomerDto,

    @CurrentUser() user: any,
  ) {
    return this.customerService.update(id, user.tenantId, dto);
  }

  @Delete(":id")
  deleteCustomer(
    @Param("id") id: string,

    @CurrentUser() user: any,
  ) {
    return this.customerService.remove(id, user.tenantId);
  }

  @Get(":id/appointments")
  getCustomerAppointments(@Param("id") id: string, @CurrentUser() user: any) {
    return this.customerService.getAppointments(id, user.tenantId);
  }

  @Post(":id/notes")
  @ApiMessage("Customer note added successfully")
  addNote(
    @Param("id") customerId: string,
    @Body() dto: CreateCustomerNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.customerService.addNote(customerId, user.tenantId, dto);
  }

  @Get(":id/notes")
  @ApiMessage("Customer notes fetched successfully")
  getNotes(@Param("id") customerId: string, @CurrentUser() user: any) {
    return this.customerService.getNotes(customerId, user.tenantId);
  }

  @Delete("notes/:noteId")
  @ApiMessage("Customer note deleted successfully")
  deleteNote(@Param("noteId") noteId: string, @CurrentUser() user: any) {
    return this.customerService.deleteNote(noteId, user.tenantId);
  }
}
