import { IsString, IsOptional } from "class-validator";

export class CreateStaffDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
