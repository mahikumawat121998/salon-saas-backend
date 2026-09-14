import { Type } from "class-transformer";
import { IsDate, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class GetAvailableSlotsDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsString()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  slotIntervalMinutes?: number = 15;
}

export class GetCalendarQueryDto {
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endDate: Date;

  @IsString()
  @IsOptional()
  staffId?: string;
}
