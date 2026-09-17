import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsBoolean,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  PayStructureType,
  ComponentType,
  ComponentCalculationType,
  CommissionType,
  CommissionCalcMode,
} from "@prisma/client";

export class SalaryComponentDto {
  @IsString()
  name: string;

  @IsEnum(ComponentType)
  type: ComponentType;

  @IsEnum(ComponentCalculationType)
  calculationType: ComponentCalculationType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;
}

export class CommissionTierDto {
  @IsNumber()
  @Min(0)
  minRevenueVolume: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxRevenueVolume?: number;

  @IsNumber()
  @Min(0)
  commissionRate: number;
}

export class CommissionRuleDto {
  @IsEnum(CommissionType)
  type: CommissionType;

  @IsEnum(CommissionCalcMode)
  calcMode: CommissionCalcMode;

  @IsOptional()
  @IsNumber()
  @Min(0)
  flatRate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionTierDto)
  tiers?: CommissionTierDto[];
}

export class CreateSalaryConfigDto {
  @IsEnum(PayStructureType)
  payStructureType: PayStructureType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeRatePerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  overtimeMultiplier?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryComponentDto)
  components?: SalaryComponentDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionRuleDto)
  commissionRules?: CommissionRuleDto[];
}
