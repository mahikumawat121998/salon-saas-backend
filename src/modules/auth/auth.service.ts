import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../common/database/prisma.service";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { LoginDto } from "./dto/login.dto";
import { randomUUID } from "crypto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

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
         tenantModules = []; // Lock out all premium modules
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
