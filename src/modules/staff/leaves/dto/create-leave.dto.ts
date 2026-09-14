import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsOptional, IsString } from "class-validator";

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
}
