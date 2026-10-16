import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { AiService } from "./ai.service";
import { SendAiMessageDto } from "./dto/chat.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ApiMessage } from "../../common/decorators/api-message.decorator";

@Controller("ai")
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("chat")
  @ApiMessage("Message processed successfully")
  async sendMessage(
    @Body() dto: SendAiMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.aiService.processChatMessage(
      user.tenantId,
      user.id,
      dto.message,
      dto.conversationId,
    );
  }

  @Get("conversations")
  @ApiMessage("Conversations fetched successfully")
  async getConversations(@CurrentUser() user: any) {
    return this.aiService.getConversations(user.tenantId, user.id);
  }

  @Get("conversations/:id")
  @ApiMessage("Conversation details fetched successfully")
  async getConversation(
    @Param("id") id: string,
    @CurrentUser() user: any,
  ) {
    return this.aiService.getConversationMessages(user.tenantId, user.id, id);
  }

  @Delete("conversations/:id")
  @ApiMessage("Conversation deleted successfully")
  async deleteConversation(
    @Param("id") id: string,
    @CurrentUser() user: any,
  ) {
    return this.aiService.deleteConversation(user.tenantId, user.id, id);
  }
}
