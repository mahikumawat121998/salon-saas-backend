import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/database/prisma.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { Queue } from "bullmq";
import * as dotenv from "dotenv";
dotenv.config({ override: true });

import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { randomUUID } from "crypto";

@Injectable()
export class AuthService {
  private notificationQueue: Queue;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.notificationQueue = new Queue("notification", {
      connection: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    });
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        tenant: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      throw new UnauthorizedException("Your account has been suspended. Please contact support.");
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const roles = user.roles.map((item) => item.role.name);

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      roles,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = randomUUID();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles,
      },
    };
  }

  async refresh(refreshToken: string) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: {
        token: refreshToken,
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
            tenant: true,
          },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    const user = storedToken.user;

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      throw new UnauthorizedException("Your account has been suspended. Please contact support.");
    }

    const roles = user.roles.map((item) => item.role.name);

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      roles,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: {
        token: refreshToken,
      },
    });

    return {
      message: "Logged out successfully",
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      return {
        message: "If an account with that email exists, a password reset link has been sent.",
      };
    }

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    try {
      await this.notificationQueue.add("email.auth.reset-password", {
        receiverEmail: user.email,
        resetLink: resetUrl,
        name: (user as any).firstName || "User",
      });
    } catch (error) {
      console.error("Failed to queue password reset email:", error);
    }

    return {
      message: "If an account with that email exists, a password reset link has been sent.",
      resetUrl,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException("Invalid or expired password reset token.");
    }

    if (resetToken.expiresAt < new Date()) {
      await this.prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      throw new BadRequestException("Password reset token has expired. Please request a new one.");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await this.prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    });

    return {
      message: "Password reset successful. You can now login with your new password.",
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        tenant: {
          include: {
            subscription: {
              include: {
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const roles = user.roles.map((item) => item.role.name);
    const permissions = Array.from(
      new Set(
        user.roles.flatMap((r) =>
          r.role.permissions.map((p) => p.permission.name)
        )
      )
    );

    let tenantModules: string[] = ["APPOINTMENTS", "CUSTOMERS", "CATALOG", "STAFF", "BILLING"];
    let subscriptionStatus = 'ACTIVE';
    let trialEndsAt: Date | null = null;
    let isTrialExpired = false;
    let planCode = 'FREE';

    if (user.tenant?.subscription) {
       subscriptionStatus = user.tenant.subscription.status;
       trialEndsAt = user.tenant.subscription.trialEndsAt;
       planCode = user.tenant.subscription.plan?.code || 'FREE';

       tenantModules = user.tenant.subscription.customAllowedModules && user.tenant.subscription.customAllowedModules.length > 0
         ? user.tenant.subscription.customAllowedModules
         : user.tenant.subscription.plan?.allowedModules || [];

       if (subscriptionStatus === 'TRIALING' && trialEndsAt && new Date() > trialEndsAt) {
         isTrialExpired = true;
         tenantModules = [];
       }
    }

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      status: user.status,
      roles,
      isSuperAdmin: user.isSuperAdmin,
      permissions: permissions.length > 0 ? permissions : ["*"],
      tenantModules,
      subscriptionStatus,
      planCode,
      trialEndsAt,
      isTrialExpired,
    };
  }
}
