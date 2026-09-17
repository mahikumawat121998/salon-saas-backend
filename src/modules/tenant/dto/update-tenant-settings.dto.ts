import { IsOptional, IsString } from "class-validator";

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  logo?: string;
}
