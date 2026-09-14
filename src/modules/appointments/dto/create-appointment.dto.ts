import { Type } from "class-transformer";
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { AppointmentSource } from "@prisma/client";

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startAt: Date;

  @IsEnum(AppointmentSource)
  @IsOptional()
  source?: AppointmentSource;

  @IsString()
  @IsOptional()
  customerNotes?: string;

  @IsString()
  @IsOptional()
  internalNotes?: string;
}
