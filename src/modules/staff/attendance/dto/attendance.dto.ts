import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { AttendanceStatus } from "@prisma/client";

export class ClockInDto {
  @IsString()
  date: string;

  @IsString()
  @IsOptional()
  clockInTime?: string; // If manager is manually setting the time, otherwise uses current time
}

export class ClockOutDto {
  @IsString()
  date: string;

  @IsString()
  @IsOptional()
  clockOutTime?: string;
}

export class MarkAbsentDto {
  @IsString()
  date: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus = "ABSENT";
}
