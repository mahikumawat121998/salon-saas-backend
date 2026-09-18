import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/database/prisma.service";
import { CreateLeaveDto } from "./dto/create-leave.dto";
import { UpdateLeaveStatusDto } from "./dto/update-leave-status.dto";

@Injectable()
export class StaffLeaveService {
  constructor(private readonly prisma: PrismaService) {}

  async createLeave(staffId: string, tenantId: string, dto: CreateLeaveDto) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
    });

    if (!staff) {
      throw new NotFoundException("Staff member not found");
    }

    if (new Date(dto.startAt) >= new Date(dto.endAt)) {
      throw new BadRequestException("startAt must be earlier than endAt");
    }

    const overlappingAppointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        staffId,
        status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
        startAt: { lt: new Date(dto.endAt) },
        endAt: { gt: new Date(dto.startAt) },
      },
    });

    if (overlappingAppointments.length > 0) {
      throw new BadRequestException(
        `Cannot apply for leave. Staff member has ${overlappingAppointments.length} scheduled appointment(s) during this period. Please reassign or cancel them first.`
      );
    }

    const leave = await this.prisma.staffLeave.create({
      data: {
        tenantId,
        staffId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        reason: dto.reason,
        type: dto.type,
      },
    });

    return leave;
  }

  async getLeaves(staffId: string, tenantId: string) {
    return this.prisma.staffLeave.findMany({
      where: { staffId, tenantId },
      orderBy: { startAt: "asc" },
    });
  }

  async getAllLeaves(tenantId: string) {
    return this.prisma.staffLeave.findMany({
      where: { tenantId },
      include: { staff: true },
      orderBy: { startAt: "desc" },
    });
  }

  async deleteLeave(leaveId: string, tenantId: string) {
    const leave = await this.prisma.staffLeave.findFirst({
      where: { id: leaveId, tenantId },
    });

    if (!leave) {
      throw new NotFoundException("Staff leave not found");
    }

    return this.prisma.staffLeave.delete({
      where: { id: leaveId },
    });
  }

  async updateLeaveStatus(leaveId: string, tenantId: string, dto: UpdateLeaveStatusDto, approvedById?: string) {
    const leave = await this.prisma.staffLeave.findFirst({
      where: { id: leaveId, tenantId },
    });

    if (!leave) {
      throw new NotFoundException("Staff leave not found");
    }

    return this.prisma.staffLeave.update({
      where: { id: leaveId },
      data: {
        status: dto.status,
        adminNote: dto.adminNote,
        approvedById: ["APPROVED", "REJECTED"].includes(dto.status) ? approvedById : null,
      },
      include: { staff: true },
    });
  }
}
