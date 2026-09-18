import { IsInt, IsNumber, IsOptional, IsString, IsArray, IsEnum } from "class-validator";
import { ServiceStatus } from "@prisma/client";

export class UpdateServiceDto {
  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsInt()
  @IsOptional()
  durationMinutes?: number;

  @IsNumber()
  @IsOptional()
  price?: number;

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
