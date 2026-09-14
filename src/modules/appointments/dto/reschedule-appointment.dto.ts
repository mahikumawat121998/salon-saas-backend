import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class RescheduleAppointmentDto {
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startAt: Date;

  @IsString()
  @IsOptional()
  staffId?: string;
}
