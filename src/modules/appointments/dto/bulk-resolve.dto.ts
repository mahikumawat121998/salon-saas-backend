import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export enum BulkResolveAction {
  REASSIGN = "REASSIGN",
  CANCEL = "CANCEL",
}

export class BulkResolveItemDto {
  @IsString()
  appointmentId: string;

  @IsEnum(BulkResolveAction)
  action: BulkResolveAction;

  @IsOptional()
  @IsString()
  newStaffId?: string;
}

export class BulkResolveDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkResolveItemDto)
  updates: BulkResolveItemDto[];
}
