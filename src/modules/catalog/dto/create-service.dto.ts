import { IsInt, IsNotEmpty, IsNumber, IsString, IsOptional, IsArray, IsEnum } from "class-validator";
import { ServiceStatus } from "@prisma/client";

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  durationMinutes: number;

  @IsNumber()
  price: number;

  @IsNumber()
  @IsOptional()
  tax?: number;

  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;

  @IsString()
  @IsOptional()
  commissionRule?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  eligibleStaffIds?: string[];
}
