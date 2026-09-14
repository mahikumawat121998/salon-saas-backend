import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/database/prisma.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { GetInvoicesQueryDto } from "./dto/invoice-query.dto";
import { AppointmentStatus, InvoiceStatus, PaymentStatus } from "@prisma/client";

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an invoice from an appointment
   */
  async createInvoice(tenantId: string, dto: CreateInvoiceDto) {
    let appointment: any = null;
    let servicePrice = 0;
    let targetCustomerId = dto.customerId;

    if (dto.appointmentId) {
      appointment = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, tenantId },
        include: { customer: true },
      });

      if (!appointment) {
        throw new NotFoundException("Appointment not found");
      }

      const existingInvoice = await this.prisma.invoice.findUnique({
        where: { appointmentId: dto.appointmentId },
      });

      if (existingInvoice) {
        throw new ConflictException("An invoice already exists for this appointment");
      }

      servicePrice = Number(appointment.price);
      targetCustomerId = appointment.customerId;
    }

    if (!targetCustomerId) {
      const firstCust = await this.prisma.customer.findFirst({ where: { tenantId } });
      if (!firstCust) {
        throw new NotFoundException("No customer found for tenant");
      }
      targetCustomerId = firstCust.id;
    }

    const itemsToCreate: Array<{ description: string; amount: number }> = [];

    if (appointment) {
      itemsToCreate.push({
        description: `Service: ${appointment.serviceName}`,
        amount: servicePrice,
      });
    }

    if (dto.additionalItems && dto.additionalItems.length > 0) {
      for (const item of dto.additionalItems) {
        itemsToCreate.push({
          description: item.description,
          amount: Number(item.amount),
        });
      }
    }

    const totalAmount = itemsToCreate.reduce((sum, item) => sum + item.amount, 0);

    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          tenantId,
          appointmentId: appointment ? appointment.id : undefined,
          customerId: targetCustomerId!,
          status: InvoiceStatus.PENDING,
          totalAmount,
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          customer: true,
          appointment: true,
          items: true,
          payments: true,
        },
      });

      if (appointment && appointment.status !== AppointmentStatus.COMPLETED) {
        await tx.appointment.update({
          where: { id: appointment.id },
          data: { status: AppointmentStatus.COMPLETED },
        });
      }

      return inv;
    });

    return invoice;
  }

  /**
   * Find all invoices for tenant
   */
  async findAll(tenantId: string, query?: GetInvoicesQueryDto) {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        ...(query?.status && { status: query.status }),
        ...(query?.customerId && { customerId: query.customerId }),
      },
      include: {
        customer: true,
        appointment: true,
        items: true,
        payments: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Find single invoice
   */
  async findOne(id: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        appointment: true,
        items: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    return invoice;
  }

  /**
   * Add a payment to an invoice
   */
  async addPayment(invoiceId: string, tenantId: string, dto: CreatePaymentDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException("Cannot make payment on a cancelled invoice");
    }

    const currentTotalPaid = invoice.payments
      .filter((p) => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalAmount = Number(invoice.totalAmount);

    if (currentTotalPaid >= totalAmount) {
      throw new BadRequestException("Invoice is already fully paid");
    }

    await this.prisma.payment.create({
      data: {
        invoiceId,
        amount: dto.amount,
        method: dto.method,
        status: PaymentStatus.COMPLETED,
        razorpayOrderId: dto.razorpayOrderId,
        razorpayPaymentId: dto.razorpayPaymentId,
        razorpaySignature: dto.razorpaySignature,
      },
    });

    const newTotalPaid = currentTotalPaid + dto.amount;

    if (newTotalPaid >= totalAmount) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.PAID },
      });
    }

    return this.findOne(invoiceId, tenantId);
  }

  /**
   * Create Razorpay Order
   */
  async createRazorpayOrder(invoiceId: string, tenantId: string, amount: number) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    const Razorpay = require("razorpay");
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_Tb9UmqkZywf37X",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "lpIZQeXn5YifQqhzCu35jDSu",
    });

    const options = {
      amount: Math.round(amount * 100), // Razorpay accepts amount in paise
      currency: "INR",
      receipt: `inv_${invoiceId.substring(0, 10)}`,
      notes: {
        invoiceId,
        tenantId,
      },
    };

    const order = await razorpay.orders.create(options);
    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_Tb9UmqkZywf37X",
    };
  }

  /**
   * Cancel an invoice
   */
  async cancelInvoice(id: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException("Cannot cancel a fully paid invoice");
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
    });
  }
}
