import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { AppointmentsService } from "./appointments.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { RescheduleAppointmentDto } from "./dto/reschedule-appointment.dto";
import { CancelAppointmentDto } from "./dto/cancel-appointment.dto";
import { UpdateAppointmentStatusDto } from "./dto/update-appointment.dto";
import { GetAvailableSlotsDto, GetCalendarQueryDto } from "./dto/appointment-query.dto";
import { BulkResolveDto } from "./dto/bulk-resolve.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/permission.decorator";
import { ApiMessage } from "../../common/decorators/api-message.decorator";

@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get("available-slots")
  @RequirePermission("APPOINTMENT_VIEW")
  @ApiMessage("Available slots calculated successfully")
  getAvailableSlots(
    @Query() query: GetAvailableSlotsDto,
    @CurrentUser() user: any,
  ) {
    return this.appointmentsService.getAvailableSlots(user.tenantId, query);
  }

  @Post()
  @RequirePermission("APPOINTMENT_CREATE")
  @ApiMessage("Appointment created successfully")
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: any) {
    return this.appointmentsService.create(user.tenantId, dto, user.id);
  }

  @Get("calendar")
  @RequirePermission("APPOINTMENT_VIEW")
  @ApiMessage("Calendar appointments fetched successfully")
  getCalendar(
    @Query() query: GetCalendarQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.appointmentsService.getCalendarView(user.tenantId, query);
  }

  @Get(":id")
  @RequirePermission("APPOINTMENT_VIEW")
  @ApiMessage("Appointment fetched successfully")
  findOne(@Param("id") id: string, @CurrentUser() user: any) {
    return this.appointmentsService.findOne(id, user.tenantId);
  }

  @Patch(":id/reschedule")
  @RequirePermission("APPOINTMENT_UPDATE")
  @ApiMessage("Appointment rescheduled successfully")
  reschedule(
    @Param("id") id: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser() user: any,
  ) {
    return this.appointmentsService.reschedule(id, user.tenantId, dto);
  }

  @Patch(":id/cancel")
  @RequirePermission("APPOINTMENT_CANCEL")
  @ApiMessage("Appointment cancelled successfully")
  cancel(
    @Param("id") id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: any,
  ) {
    return this.appointmentsService.cancel(id, user.tenantId, dto, user.id);
  }

  @Patch(":id/status")
  @RequirePermission("APPOINTMENT_UPDATE")
  @ApiMessage("Appointment status updated successfully")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.appointmentsService.updateStatus(id, user.tenantId, dto);
  }

  @Post("bulk-resolve")
  @RequirePermission("APPOINTMENT_UPDATE")
  @ApiMessage("Appointments resolved successfully")
  bulkResolve(@Body() dto: BulkResolveDto, @CurrentUser() user: any) {
    return this.appointmentsService.bulkResolve(user.tenantId, dto, user.id);
  }
}
