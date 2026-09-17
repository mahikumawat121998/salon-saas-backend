import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class AdjustPayslipDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unpaidLeaveDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualDeduction?: number;

  @IsOptional()
  @IsString()
  adjustmentReason?: string;
}
