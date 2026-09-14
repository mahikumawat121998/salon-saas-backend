import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsBoolean, IsArray } from 'class-validator';

export class UpdateTenantStatusDto {
  @IsEnum(['ACTIVE', 'SUSPENDED'])
  status: 'ACTIVE' | 'SUSPENDED';

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ImpersonateTenantDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  monthlyPrice: number;

  @IsNumber()
  yearlyPrice: number;

  @IsNumber()
  @IsOptional()
  maxOutlets?: number;

  @IsNumber()
  @IsOptional()
  maxStaff?: number;

  @IsBoolean()
  @IsOptional()
  enableInventory?: boolean;

  @IsBoolean()
  @IsOptional()
  enableReports?: boolean;

  @IsBoolean()
  @IsOptional()
  enableMarketing?: boolean;

  @IsBoolean()
  @IsOptional()
  enableWhatsApp?: boolean;

  @IsOptional()
  allowedModules?: string[];
}

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  monthlyPrice?: number;

  @IsNumber()
  @IsOptional()
  yearlyPrice?: number;

  @IsNumber()
  @IsOptional()
  maxOutlets?: number;

  @IsNumber()
  @IsOptional()
  maxStaff?: number;

  @IsBoolean()
  @IsOptional()
  enableInventory?: boolean;

  @IsBoolean()
  @IsOptional()
  enableReports?: boolean;

  @IsBoolean()
  @IsOptional()
  enableMarketing?: boolean;

  @IsBoolean()
  @IsOptional()
  enableWhatsApp?: boolean;

  @IsOptional()
  allowedModules?: string[];
}

export class UpdateTenantSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateTenantModulesDto {
  @IsArray()
  @IsString({ each: true })
  allowedModules: string[];

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  ownerEmail: string;

  @IsString()
  @IsNotEmpty()
  ownerPassword: string;

  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  razorpayPaymentId?: string;

  @IsString()
  @IsOptional()
  razorpayOrderId?: string;

  @IsString()
  @IsOptional()
  razorpaySignature?: string;
}

export class CreateOnboardingOrderDto {
  @IsString()
  @IsNotEmpty()
  planId: string;
}
