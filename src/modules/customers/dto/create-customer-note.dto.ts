import { IsNotEmpty, IsString } from "class-validator";

export class CreateCustomerNoteDto {
  @IsString()
  @IsNotEmpty()
  note: string;
}
