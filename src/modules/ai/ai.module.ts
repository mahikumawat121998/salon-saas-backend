import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/database/prisma.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AiToolsService } from "./ai-tools.service";

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [AiService, AiToolsService],
  exports: [AiService, AiToolsService],
})
export class AiModule {}
