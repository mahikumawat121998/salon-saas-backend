import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SendAiMessageDto {
  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}
