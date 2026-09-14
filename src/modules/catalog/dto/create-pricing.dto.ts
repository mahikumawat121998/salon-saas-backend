import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreatePricingDto {
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsNumber()
  price: number;
}
