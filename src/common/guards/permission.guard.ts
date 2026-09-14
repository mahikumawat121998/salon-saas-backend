import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';

export const PERMISSION_KEY = 'require_permission';
export const RequirePermission = (permissionCode: string) => SetMetadata(PERMISSION_KEY, permissionCode);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissionCode = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissionCode) {
      return true; // No permission requirement on this route
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User session unauthenticated');
    }

    // Super Admins bypass tenant restriction checks
    if (user.isSuperAdmin) {
      return true;
    }

    // 1. Fetch Permission details from catalog including its Feature
    const permission = await this.prisma.permission.findUnique({
      where: { code: requiredPermissionCode },
      include: { feature: true },
    });

    if (!permission) {
      // Fallback if permission isn't defined in database catalog yet
      return true;
    }

    const featureCode = permission.feature?.code;

    // =========================================================================
    // GATE 1: Feature Enablement Check (Tenant Subscription Level)
    // =========================================================================
    if (featureCode) {
      const tenantSubscription = await this.prisma.tenantSubscription.findUnique({
        where: { tenantId: user.tenantId },
        include: { plan: true },
      });

      const effectiveModules =
        tenantSubscription?.customAllowedModules && tenantSubscription.customAllowedModules.length > 0
          ? tenantSubscription.customAllowedModules
          : tenantSubscription?.plan?.allowedModules || ['APPOINTMENTS', 'CUSTOMERS', 'SERVICES', 'STAFF', 'BILLING'];

      const isFeatureEnabled = effectiveModules.includes(featureCode);

      if (!isFeatureEnabled) {
        throw new ForbiddenException(
          `Feature '${permission.feature?.name || featureCode}' is locked under your salon's subscription plan. Please contact your Super Admin to upgrade.`
        );
      }
    }

    // =========================================================================
    // GATE 2: Role Permission Check (User Role Level)
    // =========================================================================
    // Fetch user's assigned role permissions
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const userPermissionCodes = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        if (rp.permission?.code) {
          userPermissionCodes.add(rp.permission.code);
        }
      }
    }

    const hasRolePermission = userPermissionCodes.has(requiredPermissionCode);

    if (!hasRolePermission) {
      throw new ForbiddenException(
        `Access Denied: Your role does not have the required permission '${permission.name || requiredPermissionCode}'.`
      );
    }

    return true;
  }
}
