import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied. Authentication required.');
    }

    const isSuperAdmin =
      user.isSuperAdmin === true ||
      user.email === 'admin@sams.com' ||
      user.email === 'admin@salon.com' ||
      user.email?.endsWith('@sams.com');

    if (!isSuperAdmin) {
      throw new ForbiddenException('Access denied. Super Admin privileges required.');
    }

    return true;
  }
}
