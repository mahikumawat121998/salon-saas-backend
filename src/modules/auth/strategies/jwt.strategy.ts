import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../../common/database/prisma.service";
import { JwtPayload } from "../types/jwt-payload.type";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  // async validate(payload: JwtPayload) {
  //   const user = await this.prisma.user.findUnique({
  //     where: {
  //       id: payload.sub,
  //     },

  //     include: {
  //       roles: {
  //         include: {
  //           role: true,
  //         },
  //       },
  //     },
  //   });
  //   console.log("SEARCHING USER ID:", payload.sub);
  //   console.log("USER:", user);
  //   if (!user) {
  //     throw new UnauthorizedException("User not found");
  //   }

  //   return {
  //     id: user.id,

  //     tenantId: user.tenantId,

  //     email: user.email,

  //     roles: user.roles.map((item) => item.role.name),
  //   };
  // }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
      include: {
        tenant: {
          select: { status: true }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      throw new UnauthorizedException("Your account has been suspended. Please contact support.");
    }

    return user;
  }
}
