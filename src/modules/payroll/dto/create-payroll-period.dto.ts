import { IsString, IsDateString, IsNumber, Min } from "class-validator";

export class CreatePayrollPeriodDto {
  @IsString()
  name: string; // e.g. "Payroll - October 2026"

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @Min(1)
  workingDaysCount: number;
}
