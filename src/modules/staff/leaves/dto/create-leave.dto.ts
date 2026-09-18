import { Type } from "class-transformer";
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { LeaveType } from "@prisma/client";

export class CreateLeaveDto {
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startAt: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endAt: Date;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsEnum(LeaveType)
  @IsOptional()
  type?: LeaveType = LeaveType.CASUAL;
}
