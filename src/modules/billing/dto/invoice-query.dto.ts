import { IsEnum, IsOptional, IsString } from "class-validator";
import { InvoiceStatus } from "@prisma/client";

export class GetInvoicesQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  customerId?: string;
}
