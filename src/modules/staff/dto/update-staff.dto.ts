import { IsOptional, IsString, IsEnum } from "class-validator";

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(["ACTIVE", "INACTIVE"])
  status?: string;

  @IsOptional()
  @IsString()
  profilePicture?: string;
}
