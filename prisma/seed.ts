import { PrismaClient, AppointmentStatus, StaffStatus, InvoiceStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting 3-Layer Authorization & Feature Catalog Seeding...");

  // Clean up existing tables for idempotent seeding
  await prisma.auditLog.deleteMany();
  await prisma.tenantSubscription.deleteMany();
  await prisma.planFeature.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.appointmentTimeline.deleteMany();
  await prisma.appointmentItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.staffBreak.deleteMany();
  await prisma.staffLeave.deleteMany();
  await prisma.staffSchedule.deleteMany();
  await prisma.staffService.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.customerNote.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.pricing.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceCategory.deleteMany();
  await prisma.inventoryProduct.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.feature.deleteMany();
  await prisma.role.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenantBusinessHour.deleteMany();
  await prisma.tenantSettings.deleteMany();
  await prisma.tenant.deleteMany();

  // 1. Create System Tenant & Super Admin Accounts
  const systemTenant = await prisma.tenant.create({
    data: {
      name: "SYSTEM",
      status: "ACTIVE",
      settings: {
        create: {
          timezone: "UTC",
          currency: "INR",
        },
      },
    },
  });

  const superAdminRole = await prisma.role.create({
    data: {
      tenantId: systemTenant.id,
      name: "SUPER_ADMIN",
    },
  });

  await prisma.user.create({
    data: {
      tenantId: systemTenant.id,
      email: "admin@salon.com",
      passwordHash: await bcrypt.hash("Admin@123", 10),
      isSuperAdmin: true,
      roles: { create: { roleId: superAdminRole.id } },
    },
  });

  await prisma.user.create({
    data: {
      tenantId: systemTenant.id,
      email: "superadmin@sams.com",
      passwordHash: await bcrypt.hash("SuperAdmin@123", 10),
      isSuperAdmin: true,
      roles: { create: { roleId: superAdminRole.id } },
    },
  });

  // 2. Create Global Feature Catalog
  console.log("📦 Creating Features Catalog...");
  const featuresData = [
    { code: "CUSTOMERS", name: "Customer CRM", description: "Manage customer directory, history & notes", category: "Core Operations" },
    { code: "APPOINTMENTS", name: "Appointment Booking", description: "Manage bookings, calendar & schedules", category: "Core Operations" },
    { code: "STAFF", name: "Staff Management", description: "Manage staff roster, shifts & performance", category: "Core Operations" },
    { code: "SERVICES", name: "Service Catalog", description: "Manage services, pricing & categories", category: "Core Operations" },
    { code: "BILLING", name: "POS & Billing", description: "POS invoices, payments & receipts", category: "Core Operations" },
    { code: "INVENTORY", name: "Stock & Inventory", description: "Track product stock, suppliers & reorders", category: "Advanced Modules" },
    { code: "REPORTS", name: "Business Analytics", description: "Revenue analytics & performance reports", category: "Advanced Modules" },
    { code: "MARKETING", name: "Marketing Campaigns", description: "SMS & email promotions", category: "Growth & Engagement" },
    { code: "LOYALTY", name: "Loyalty Program", description: "Customer rewards & points management", category: "Growth & Engagement" },
    { code: "WHATSAPP", name: "WhatsApp Automation", description: "Automated booking & reminder messages", category: "Growth & Engagement" },
  ];

  const featuresMap: Record<string, any> = {};
  for (const f of featuresData) {
    const feat = await prisma.feature.create({ data: f });
    featuresMap[f.code] = feat;
  }

  // 3. Create Granular Permissions mapped to Features
  console.log("🔑 Creating Granular Permissions...");
  const permissionsData = [
    // Customers
    { code: "customers.view", name: "View Customers", description: "View customer profiles and history", featureCode: "CUSTOMERS" },
    { code: "customers.create", name: "Create Customer", description: "Add new customer profiles", featureCode: "CUSTOMERS" },
    { code: "customers.update", name: "Update Customer", description: "Edit customer profile details", featureCode: "CUSTOMERS" },
    { code: "customers.delete", name: "Delete Customer", description: "Remove customer records", featureCode: "CUSTOMERS" },
    { code: "customers.export", name: "Export Customer Data", description: "Export customer records as CSV", featureCode: "CUSTOMERS" },

    // Appointments
    { code: "appointments.view", name: "View Appointments", description: "View calendar and bookings", featureCode: "APPOINTMENTS" },
    { code: "appointments.create", name: "Create Booking", description: "Book new appointments", featureCode: "APPOINTMENTS" },
    { code: "appointments.update", name: "Update Booking", description: "Reschedule or edit appointments", featureCode: "APPOINTMENTS" },
    { code: "appointments.cancel", name: "Cancel Booking", description: "Cancel appointment bookings", featureCode: "APPOINTMENTS" },

    // Staff
    { code: "staff.view", name: "View Staff", description: "View staff list and schedules", featureCode: "STAFF" },
    { code: "staff.create", name: "Create Staff", description: "Onboard new staff members", featureCode: "STAFF" },
    { code: "staff.update", name: "Update Staff", description: "Modify staff roles & shifts", featureCode: "STAFF" },
    { code: "staff.delete", name: "Delete Staff", description: "Remove staff profiles", featureCode: "STAFF" },

    // Services
    { code: "services.view", name: "View Service Catalog", description: "View service items & pricing", featureCode: "SERVICES" },
    { code: "services.create", name: "Create Service", description: "Add new services & categories", featureCode: "SERVICES" },
    { code: "services.update", name: "Update Service", description: "Modify service prices & duration", featureCode: "SERVICES" },
    { code: "services.delete", name: "Delete Service", description: "Remove services", featureCode: "SERVICES" },

    // Billing
    { code: "billing.view", name: "View Invoices", description: "View sales invoices & receipts", featureCode: "BILLING" },
    { code: "billing.create", name: "Generate Invoice", description: "Create invoices & collect payments", featureCode: "BILLING" },
    { code: "billing.refund", name: "Process Refund", description: "Issue billing refunds", featureCode: "BILLING" },

    // Inventory
    { code: "inventory.view", name: "View Inventory", description: "View product stock levels", featureCode: "INVENTORY" },
    { code: "inventory.create", name: "Add Stock", description: "Add new stock items", featureCode: "INVENTORY" },
    { code: "inventory.update", name: "Update Stock", description: "Adjust stock levels", featureCode: "INVENTORY" },

    // Reports
    { code: "reports.view", name: "View Analytics", description: "View revenue & sales reports", featureCode: "REPORTS" },
    { code: "reports.export", name: "Export Reports", description: "Export financial reports", featureCode: "REPORTS" },

    // Marketing & Loyalty & WhatsApp
    { code: "marketing.view", name: "View Campaigns", description: "View marketing campaigns", featureCode: "MARKETING" },
    { code: "loyalty.manage", name: "Manage Loyalty", description: "Configure customer loyalty points", featureCode: "LOYALTY" },
    { code: "whatsapp.send", name: "Send WhatsApp", description: "Send automated WhatsApp notifications", featureCode: "WHATSAPP" },
  ];

  const permissionsMap: Record<string, any> = {};
  for (const p of permissionsData) {
    const feat = featuresMap[p.featureCode];
    const perm = await prisma.permission.create({
      data: {
        code: p.code,
        name: p.name,
        description: p.description,
        featureId: feat.id,
      },
    });
    permissionsMap[p.code] = perm;
  }

  // 4. Create Subscription Plans with Feature Mappings (`PlanFeature`)
  console.log("💳 Creating Subscription Plans & PlanFeatures...");
  const starterPlan = await prisma.subscriptionPlan.create({
    data: {
      name: "Starter",
      code: "STARTER",
      description: "Essential tools for boutique salons",
      monthlyPrice: 499,
      yearlyPrice: 4990,
      maxOutlets: 1,
      maxStaff: 5,
      allowedModules: ["APPOINTMENTS", "CUSTOMERS", "SERVICES", "STAFF", "BILLING"],
    },
  });

  const proPlan = await prisma.subscriptionPlan.create({
    data: {
      name: "Professional",
      code: "PRO",
      description: "Advanced management for growing salons",
      monthlyPrice: 999,
      yearlyPrice: 9990,
      maxOutlets: 3,
      maxStaff: 15,
      enableInventory: true,
      enableReports: true,
      allowedModules: ["APPOINTMENTS", "CUSTOMERS", "SERVICES", "STAFF", "BILLING", "INVENTORY", "REPORTS", "LOYALTY"],
    },
  });

  const enterprisePlan = await prisma.subscriptionPlan.create({
    data: {
      name: "Enterprise",
      code: "ENTERPRISE",
      description: "Full suite for large salon chains",
      monthlyPrice: 1999,
      yearlyPrice: 19990,
      maxOutlets: 10,
      maxStaff: 50,
      enableInventory: true,
      enableReports: true,
      enableMarketing: true,
      enableWhatsApp: true,
      allowedModules: ["APPOINTMENTS", "CUSTOMERS", "SERVICES", "STAFF", "BILLING", "INVENTORY", "REPORTS", "MARKETING", "LOYALTY", "WHATSAPP"],
    },
  });

  const trialPlan = await prisma.subscriptionPlan.create({
    data: {
      name: "30-Day Free Trial",
      code: "TRIAL",
      description: "Full access to all enterprise features for 30 days",
      monthlyPrice: 0,
      yearlyPrice: 0,
      maxOutlets: 10,
      maxStaff: 50,
      enableInventory: true,
      enableReports: true,
      enableMarketing: true,
      enableWhatsApp: true,
      allowedModules: ["APPOINTMENTS", "CUSTOMERS", "SERVICES", "STAFF", "BILLING", "INVENTORY", "REPORTS", "MARKETING", "LOYALTY", "WHATSAPP"],
    },
  });

  // Link Features to Plans
  const starterFeatureCodes = ["CUSTOMERS", "APPOINTMENTS", "STAFF", "SERVICES", "BILLING"];
  for (const code of starterFeatureCodes) {
    await prisma.planFeature.create({ data: { planId: starterPlan.id, featureId: featuresMap[code].id } });
  }

  const proFeatureCodes = ["CUSTOMERS", "APPOINTMENTS", "STAFF", "SERVICES", "BILLING", "INVENTORY", "REPORTS", "LOYALTY"];
  for (const code of proFeatureCodes) {
    await prisma.planFeature.create({ data: { planId: proPlan.id, featureId: featuresMap[code].id } });
  }

  const enterpriseFeatureCodes = ["CUSTOMERS", "APPOINTMENTS", "STAFF", "SERVICES", "BILLING", "INVENTORY", "REPORTS", "MARKETING", "LOYALTY", "WHATSAPP"];
  for (const code of enterpriseFeatureCodes) {
    await prisma.planFeature.create({ data: { planId: enterprisePlan.id, featureId: featuresMap[code].id } });
  }

  const trialFeatureCodes = ["CUSTOMERS", "APPOINTMENTS", "STAFF", "SERVICES", "BILLING", "INVENTORY", "REPORTS", "MARKETING", "LOYALTY", "WHATSAPP"];
  for (const code of trialFeatureCodes) {
    await prisma.planFeature.create({ data: { planId: trialPlan.id, featureId: featuresMap[code].id } });
  }

  // 5. Create Demo Salon Tenant with Pro Plan
  console.log("🏢 Seeding Demo Salon Tenant...");
  const demoTenant = await prisma.tenant.create({
    data: {
      name: "Glamour Haven Salon",
      status: "ACTIVE",
      settings: {
        create: {
          timezone: "Asia/Kolkata",
          currency: "INR",
        },
      },
      businessHours: {
        createMany: {
          data: [
            { dayOfWeek: 0, openTime: "10:00", closeTime: "20:00", isOpen: true },
            { dayOfWeek: 1, openTime: "09:00", closeTime: "21:00", isOpen: true },
            { dayOfWeek: 2, openTime: "09:00", closeTime: "21:00", isOpen: true },
            { dayOfWeek: 3, openTime: "09:00", closeTime: "21:00", isOpen: true },
            { dayOfWeek: 4, openTime: "09:00", closeTime: "21:00", isOpen: true },
            { dayOfWeek: 5, openTime: "09:00", closeTime: "21:00", isOpen: true },
            { dayOfWeek: 6, openTime: "09:00", closeTime: "21:00", isOpen: true },
          ],
        },
      },
    },
  });

  await prisma.tenantSubscription.create({
    data: {
      tenantId: demoTenant.id,
      planId: proPlan.id,
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 365 * 86400000),
      customAllowedModules: [],
    },
  });

  // 6. Create Tenant Roles & Assign Permissions
  console.log("👥 Creating Tenant Roles & RolePermissions...");
  const ownerRole = await prisma.role.create({
    data: { tenantId: demoTenant.id, name: "OWNER" },
  });

  const managerRole = await prisma.role.create({
    data: { tenantId: demoTenant.id, name: "MANAGER" },
  });

  const receptionistRole = await prisma.role.create({
    data: { tenantId: demoTenant.id, name: "RECEPTIONIST" },
  });

  const staffRole = await prisma.role.create({
    data: { tenantId: demoTenant.id, name: "STAFF" },
  });

  // Assign Permissions to OWNER (All permissions)
  for (const permCode of Object.keys(permissionsMap)) {
    await prisma.rolePermission.create({
      data: { roleId: ownerRole.id, permissionId: permissionsMap[permCode].id },
    });
  }

  // Assign Permissions to MANAGER
  const managerPermCodes = [
    "appointments.view", "appointments.create", "appointments.update", "appointments.cancel",
    "customers.view", "customers.create", "customers.update",
    "staff.view", "services.view", "billing.view", "billing.create", "inventory.view", "inventory.create", "reports.view"
  ];
  for (const code of managerPermCodes) {
    if (permissionsMap[code]) {
      await prisma.rolePermission.create({ data: { roleId: managerRole.id, permissionId: permissionsMap[code].id } });
    }
  }

  // Assign Permissions to RECEPTIONIST
  const receptionistPermCodes = [
    "appointments.view", "appointments.create", "appointments.update",
    "customers.view", "customers.create", "billing.view", "billing.create"
  ];
  for (const code of receptionistPermCodes) {
    if (permissionsMap[code]) {
      await prisma.rolePermission.create({ data: { roleId: receptionistRole.id, permissionId: permissionsMap[code].id } });
    }
  }

  // Assign Permissions to STAFF
  const staffPermCodes = ["appointments.view", "customers.view"];
  for (const code of staffPermCodes) {
    if (permissionsMap[code]) {
      await prisma.rolePermission.create({ data: { roleId: staffRole.id, permissionId: permissionsMap[code].id } });
    }
  }

  // 7. Create Demo Users
  console.log("👤 Creating Demo Users...");
  const passwordHash = await bcrypt.hash("Owner@123", 10);
  
  await prisma.user.create({
    data: {
      tenantId: demoTenant.id,
      email: "owner@glamourhaven.com",
      passwordHash,
      roles: { create: { roleId: ownerRole.id } },
    },
  });

  await prisma.user.create({
    data: {
      tenantId: demoTenant.id,
      email: "manager@glamourhaven.com",
      passwordHash: await bcrypt.hash("Manager@123", 10),
      roles: { create: { roleId: managerRole.id } },
    },
  });

  await prisma.user.create({
    data: {
      tenantId: demoTenant.id,
      email: "reception@glamourhaven.com",
      passwordHash: await bcrypt.hash("Reception@123", 10),
      roles: { create: { roleId: receptionistRole.id } },
    },
  });

  // 8. Create Categories, Services, Staff, Customers & Invoices
  console.log("💈 Creating Salon Operational Data...");
  const catHair = await prisma.serviceCategory.create({
    data: { tenantId: demoTenant.id, name: "Hair Styling & Care" },
  });

  const s1 = await prisma.service.create({
    data: { tenantId: demoTenant.id, categoryId: catHair.id, name: "Signature Haircut & Blowdry", durationMinutes: 45, price: 850.00 },
  });

  const staff1 = await prisma.staff.create({
    data: { tenantId: demoTenant.id, name: "Aarav Sharma", phone: "+91 98765 43210", status: StaffStatus.ACTIVE },
  });

  const cust1 = await prisma.customer.create({
    data: { tenantId: demoTenant.id, name: "Priya Ananya", phone: "+91 98111 22334", email: "priya@gmail.com" },
  });

  const appt1 = await prisma.appointment.create({
    data: {
      tenantId: demoTenant.id,
      customerId: cust1.id,
      staffId: staff1.id,
      serviceId: s1.id,
      appointmentDate: new Date(),
      startAt: new Date(),
      endAt: new Date(Date.now() + 45 * 60000),
      serviceName: s1.name,
      durationMinutes: 45,
      price: 850.00,
      status: AppointmentStatus.COMPLETED,
    },
  });

  await prisma.appointmentItem.create({
    data: { tenantId: demoTenant.id, appointmentId: appt1.id, serviceId: s1.id, serviceName: s1.name, durationMinutes: 45, price: 850.00 },
  });


  const inv1 = await prisma.invoice.create({
    data: {
      tenantId: demoTenant.id,
      appointmentId: appt1.id,
      customerId: cust1.id,
      totalAmount: 850.00,
      status: InvoiceStatus.PAID,
    },
  });

  await prisma.payment.create({
    data: { invoiceId: inv1.id, amount: 850.00, method: PaymentMethod.UPI, status: PaymentStatus.COMPLETED },
  });

  console.log("✅ 3-Layer Authorization Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
