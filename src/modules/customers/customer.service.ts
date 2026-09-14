import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../common/database/prisma.service";

import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CreateCustomerNoteDto } from "./dto/create-customer-note.dto";

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCustomerDto) {
    const customer = await this.prisma.customer.create({
      data: {
        tenantId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        notes: dto.notes,
        dob: dto.dob ? new Date(dto.dob) : null,
        gender: dto.gender,
        status: dto.status,
        isVip: dto.isVip,
        source: dto.source,
      },
    });

    return {
      message: "Customer created successfully",
      data: customer,
    };
  }

  async findAll(tenantId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { tenantId },
      include: {
        appointments: { select: { status: true, appointmentDate: true, serviceName: true, staff: { select: { name: true } } } },
        invoices: { select: { status: true, totalAmount: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return customers.map(customer => {
      const completedAppointments = customer.appointments.filter(a => a.status === 'COMPLETED');
      const paidInvoices = customer.invoices.filter(i => i.status === 'PAID');
      
      const totalVisits = completedAppointments.length;
      const totalSpent = paidInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      
      const sortedAppointments = [...completedAppointments].sort((a, b) => b.appointmentDate.getTime() - a.appointmentDate.getTime());
      const lastVisit = sortedAppointments.length > 0 ? sortedAppointments[0].appointmentDate : null;
      const lastAppointment = sortedAppointments.length > 0 ? {
        service: sortedAppointments[0].serviceName,
        staff: sortedAppointments[0].staff.name,
        date: sortedAppointments[0].appointmentDate
      } : null;

      // Exclude heavy relations from direct output
      const { appointments, invoices, ...rest } = customer;
      
      return {
        ...rest,
        totalVisits,
        totalSpent,
        lastVisit,
        lastAppointment
      };
    });
  }
  async findOne(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        customerNotes: true,
        appointments: {
          include: { items: true, staff: true },
          orderBy: { appointmentDate: "desc" }
        },
        invoices: true,
      },
    });

    if (!customer) return null;

    const completedAppointments = customer.appointments.filter(a => a.status === 'COMPLETED');
    const paidInvoices = customer.invoices.filter(i => i.status === 'PAID');
    
    const totalVisits = completedAppointments.length;
    const totalSpent = paidInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const lastVisit = completedAppointments.length > 0 ? completedAppointments[0].appointmentDate : null;

    return {
      ...customer,
      totalVisits,
      totalSpent,
      lastVisit
    };
  }
  async update(id: string, tenantId: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) throw new NotFoundException("Customer not found");

    const { dob, ...rest } = dto;

    return this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...rest,
        ...(dob !== undefined && { dob: dob ? new Date(dob) : null }),
      },
    });
  }
  async remove(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return this.prisma.customer.delete({
      where: {
        id: customer.id,
      },
    });
  }
  async getAppointments(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return this.prisma.appointment.findMany({
      where: {
        customerId: id,
        tenantId,
      },

      include: {
        items: true,
        staff: true,
      },

      orderBy: {
        startAt: "desc",
      },
    });
  }

  async addNote(customerId: string, tenantId: string, dto: CreateCustomerNoteDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return this.prisma.customerNote.create({
      data: {
        customerId,
        note: dto.note,
      },
    });
  }

  async getNotes(customerId: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return this.prisma.customerNote.findMany({
      where: { customerId },
    });
  }

  async deleteNote(noteId: string, tenantId: string) {
    const note = await this.prisma.customerNote.findFirst({
      where: {
        id: noteId,
        customer: { tenantId },
      },
    });

    if (!note) {
      throw new NotFoundException("Customer note not found");
    }

    return this.prisma.customerNote.delete({
      where: { id: noteId },
    });
  }
}
