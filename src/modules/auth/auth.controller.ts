import { Body, Controller, Post, Get, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { LogoutDto } from "./dto/logout.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import { ApiMessage } from "src/common/decorators/api-message.decorator";
import { RequirePermission } from "../../common/decorators/permission.decorator";
import { Public } from "../../common/decorators/public.decorator";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  //   @Post("login")
  //   login(@Body() dto: LoginDto) {
  //     return this.authService.login(dto);
  //   }

  @Post("login")
  @Public()
  @ApiMessage("Login successful")
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto);
  }

  @Post("refresh")
  @Public()
  @ApiMessage("Access token refreshed successfully")
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }
  @Post("logout")
  @ApiMessage("Logout successful")
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get("me")
  @ApiMessage("Profile Data fetched Successfully")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user) {
    return this.authService.getMe(user.id);
  }

  @Get("permission-test")
  @RequirePermission("CUSTOMER_DELETE12")
  testPermission() {
    return {
      message: "Permission granted",
    };
  }
}
