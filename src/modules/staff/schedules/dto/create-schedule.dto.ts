import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class StaffScheduleItemDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "startTime must be in HH:mm format (e.g. 09:00)",
  })
  startTime: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: "endTime must be in HH:mm format (e.g. 18:00)",
  })
  endTime: string;

  @IsBoolean()
  @IsOptional()
  isWorking?: boolean;
}

export class SetWeeklyScheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaffScheduleItemDto)
  schedules: StaffScheduleItemDto[];
}
