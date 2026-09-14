import { SetMetadata } from "@nestjs/common";

export const REQUIRE_PERMISSION = "required_permission";

export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRE_PERMISSION, permission);
