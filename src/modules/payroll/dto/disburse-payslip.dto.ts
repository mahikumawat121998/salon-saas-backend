import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaymentMode } from "@prisma/client";

export class DisbursePayslipDto {
  @IsEnum(PaymentMode)
  paymentMode: PaymentMode;

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  paymentNotes?: string;
}
