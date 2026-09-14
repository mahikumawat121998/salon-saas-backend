import { IsNumber, IsOptional } from "class-validator";

export class UpdatePricingDto {
  @IsNumber()
  @IsOptional()
  price?: number;
}
