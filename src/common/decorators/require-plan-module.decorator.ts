import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PLAN_MODULE_KEY = 'require_plan_module';
export const RequirePlanModule = (moduleName: string) => SetMetadata(REQUIRE_PLAN_MODULE_KEY, moduleName);
