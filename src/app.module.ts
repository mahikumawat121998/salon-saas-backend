import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { PrismaModule } from "./common/database/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UploadsModule } from './modules/uploads/uploads.module';

import { JwtAuthGuard } from "./modules/auth/guards/jwt-auth.guard";
import { PermissionGuard } from "./common/guards/permission.guard";

import { Reflector } from "@nestjs/core";
import { PrismaService } from "./common/database/prisma.service";
import { TenantModule } from "./modules/tenant/tenant.module";
import { TestModule } from "./modules/test/test.module";
import { CustomerModule } from "./modules/customers/customer.module";
import { StaffModule } from "./modules/staff/staff.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { BillingModule } from "./modules/billing/billing.module";
import { RolesModule } from "./modules/roles/roles.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AdminModule } from "./modules/admin/admin.module";
import { PayrollModule } from "./modules/payroll/payroll.module";
import { AttendanceModule } from './modules/attendance/attendance.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenantModule,
    TestModule,
    CustomerModule,
    StaffModule,
    CatalogModule,
    InventoryModule,
    AppointmentsModule,
    BillingModule,
    RolesModule,
    ReportsModule,
    AdminModule,
    PayrollModule,
    AttendanceModule,
    UploadsModule,
  ],

  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, prisma: PrismaService) => {
        return new PermissionGuard(reflector, prisma);
      },
      inject: [Reflector, PrismaService],
    },
  ],
})
export class AppModule {}
