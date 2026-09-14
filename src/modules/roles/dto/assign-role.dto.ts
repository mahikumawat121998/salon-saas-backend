import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class AssignUserRolesDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}
