import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../common/database/prisma.service";

@Controller("test")
export class TestController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async test() {
    const users = await this.prisma.user.findMany();
    return {
      success: true,
      count: users.length,
      users,
    };
  }
}
