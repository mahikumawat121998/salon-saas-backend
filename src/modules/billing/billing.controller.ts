import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { GetInvoicesQueryDto } from "./dto/invoice-query.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ApiMessage } from "../../common/decorators/api-message.decorator";

@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post("invoices")
  @ApiMessage("Invoice generated successfully")
  createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: any) {
    console.log(">>> [DEBUG BillingController.createInvoice] Received body:", JSON.stringify(dto));
    return this.billingService.createInvoice(user.tenantId, dto);
  }

  @Get("invoices")
  @ApiMessage("Invoices fetched successfully")
  findAll(@Query() query: GetInvoicesQueryDto, @CurrentUser() user: any) {
    return this.billingService.findAll(user.tenantId, query);
  }

  @Get("invoices/:id")
  @ApiMessage("Invoice details fetched successfully")
  findOne(@Param("id") id: string, @CurrentUser() user: any) {
    return this.billingService.findOne(id, user.tenantId);
  }

  @Post("invoices/:id/payments")
  @ApiMessage("Payment recorded successfully")
  addPayment(
    @Param("id") id: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.billingService.addPayment(id, user.tenantId, dto);
  }

  @Post("invoices/:id/razorpay-order")
  @ApiMessage("Razorpay order created successfully")
  createRazorpayOrder(
    @Param("id") id: string,
    @Body("amount") amount: number,
    @CurrentUser() user: any,
  ) {
    return this.billingService.createRazorpayOrder(id, user.tenantId, amount);
  }

  @Patch("invoices/:id/cancel")
  @ApiMessage("Invoice cancelled successfully")
  cancelInvoice(@Param("id") id: string, @CurrentUser() user: any) {
    return this.billingService.cancelInvoice(id, user.tenantId);
  }
}
