import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PLAN_MODULE_KEY } from '../decorators/require-plan-module.decorator';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(
      REQUIRE_PLAN_MODULE_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Super Admins bypass subscription module locks
    if (user?.isSuperAdmin) {
      return true;
    }

    const tenantId = user?.tenantId || request.headers['x-tenant-id'];
    if (!tenantId) {
      return true;
    }

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PLAN_UPGRADE_REQUIRED',
        message: `No active subscription found. Please subscribe to a plan to access the ${requiredModule} module.`,
        requiredModule,
      });
    }

    const allowedModules =
      subscription.customAllowedModules && subscription.customAllowedModules.length > 0
        ? subscription.customAllowedModules
        : subscription.plan.allowedModules || [];

    const hasPermission = allowedModules.includes(requiredModule);

    if (!hasPermission) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PLAN_UPGRADE_REQUIRED',
        message: `Your current plan (${subscription.plan.name}) does not include access to the ${requiredModule} module. Please upgrade to a higher tier plan.`,
        requiredModule,
        currentPlan: subscription.plan.name,
        currentPlanCode: subscription.plan.code,
      });
    }

    return true;
  }
}
