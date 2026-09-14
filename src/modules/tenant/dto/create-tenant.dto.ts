import { IsEmail, IsOptional, IsString } from "class-validator";

export class CreateTenantDto {
  @IsString()
  name: string;

  @IsEmail()
  ownerEmail: string;

  @IsString()
  ownerPassword: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
