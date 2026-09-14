import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UpdateTenantStatusDto, ImpersonateTenantDto, CreatePlanDto, UpdatePlanDto, CreateTenantDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // 1. Get Platform Metrics Overview
  async getPlatformMetrics() {
    const totalTenants = await this.prisma.tenant.count({ where: { NOT: { name: 'SYSTEM' } } });
    const activeTenants = await this.prisma.tenant.count({ where: { NOT: { name: 'SYSTEM' }, status: 'ACTIVE' } });
    const suspendedTenants = await this.prisma.tenant.count({ where: { NOT: { name: 'SYSTEM' }, status: 'SUSPENDED' } });
    const totalUsers = await this.prisma.user.count({ where: { isSuperAdmin: false } });

    // Total Salon GMV processed system-wide
    const invoiceSum = await this.prisma.invoice.aggregate({
      _sum: { totalAmount: true },
    });

    const totalGMV = invoiceSum._sum.totalAmount || 0;

    return {
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalUsers,
      totalGMV,
      samsMRR: activeTenants * 999, // Base default MRR estimation
    };
  }

  // Get Detailed Platform Revenue & Billing Overview
  async getPlatformRevenue(search?: string, status?: string) {
    const totalTenants = await this.prisma.tenant.count({ where: { NOT: { name: 'SYSTEM' } } });
    const activeTenants = await this.prisma.tenant.count({ where: { NOT: { name: 'SYSTEM' }, status: 'ACTIVE' } });

    // Total Salon GMV processed system-wide
    const invoiceSum = await this.prisma.invoice.aggregate({
      _sum: { totalAmount: true },
    });
    const totalGMV = invoiceSum._sum.totalAmount || 0;

    const totalInvoicesCount = await this.prisma.invoice.count();

    // Fetch active tenant subscriptions to compute SaaS MRR
    const activeSubscriptions = await this.prisma.tenantSubscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true },
    });

    const saasMRR = activeSubscriptions.reduce((sum, sub) => sum + (sub.plan?.monthlyPrice || 0), 0);

    // Filtered Invoices Query
    const invoiceWhere: any = {};
    if (status && status !== 'all') {
      invoiceWhere.status = status;
    }
    if (search) {
      invoiceWhere.tenant = { name: { contains: search, mode: 'insensitive' } };
    }

    const invoices = await this.prisma.invoice.findMany({
      where: invoiceWhere,
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, email: true } },
        payments: { select: { method: true, amount: true, status: true } },
      },
    });

    // Plan revenue breakdown
    const plans = await this.prisma.subscriptionPlan.findMany({
      include: { _count: { select: { subscriptions: true } } },
    });

    const planRevenueBreakdown = plans.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      monthlyPrice: p.monthlyPrice,
      subscribersCount: p._count.subscriptions,
      totalMRR: p._count.subscriptions * p.monthlyPrice,
    }));

    return {
      totalTenants,
      activeTenants,
      totalGMV,
      saasMRR,
      totalInvoicesCount,
      planRevenueBreakdown,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: `INV-${inv.id.substring(0, 8).toUpperCase()}`,
        tenantName: inv.tenant?.name || 'Unknown Salon',
        customerName: inv.customer?.name || 'Walk-in Client',
        customerEmail: inv.customer?.email || 'N/A',
        totalAmount: inv.totalAmount,
        status: inv.status,
        paymentMethod: inv.payments[0]?.method || 'CASH',
        createdAt: inv.createdAt,
      })),
    };
  }

  // 2. Get All Tenants Directory with Usage Counts & Subscriptions
  async getTenants(search?: string, status?: string) {
    const where: any = {
      NOT: { name: 'SYSTEM' },
    };
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          take: 1,
          select: { id: true, email: true, status: true },
        },
        subscription: {
          include: { plan: true },
        },
        _count: {
          select: {
            customers: true,
            staff: true,
            appointments: true,
            invoices: true,
          },
        },
      },
    });

    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      createdAt: tenant.createdAt,
      ownerEmail: tenant.users[0]?.email || 'N/A',
      counts: tenant._count,
      subscription: tenant.subscription
        ? {
            planId: tenant.subscription.planId,
            planName: tenant.subscription.plan.name,
            planCode: tenant.subscription.plan.code,
            status: tenant.subscription.status,
            currentPeriodEnd: tenant.subscription.currentPeriodEnd,
            customAllowedModules: tenant.subscription.customAllowedModules || [],
            effectiveModules:
              tenant.subscription.customAllowedModules && tenant.subscription.customAllowedModules.length > 0
                ? tenant.subscription.customAllowedModules
                : tenant.subscription.plan.allowedModules,
          }
        : {
            planId: '',
            planName: 'Trial',
            planCode: 'STARTER',
            status: 'TRIALING',
            currentPeriodEnd: new Date(Date.now() + 14 * 86400000),
            customAllowedModules: [],
            effectiveModules: ['APPOINTMENTS', 'CUSTOMERS', 'CATALOG', 'STAFF', 'BILLING'],
          },
    }));
  }

  // 3. Get Detailed Tenant Overview
  async getTenantById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, email: true, createdAt: true } },
        subscription: { include: { plan: true } },
        _count: { select: { customers: true, staff: true, appointments: true, invoices: true } },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    const totalRevenue = await this.prisma.invoice.aggregate({
      where: { tenantId: id },
      _sum: { totalAmount: true },
    });

    const recentAuditLogs = await this.prisma.auditLog.findMany({
      where: { targetTenantId: id },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...tenant,
      totalGMV: totalRevenue._sum.totalAmount || 0,
      recentAuditLogs,
    };
  }

  // 4. Create Razorpay Onboarding Order
  async createOnboardingOrder(planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Selected subscription plan not found');
    
    if (plan.monthlyPrice === 0) {
      return { orderId: null, amount: 0, currency: 'INR' }; // Free / Trial plan
    }

    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_Tb9UmqkZywf37X',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'lpIZQeXn5YifQqhzCu35jDSu',
    });

    const options = {
      amount: Math.round(plan.monthlyPrice * 100),
      currency: 'INR',
      receipt: `onboard_${Date.now()}`,
      notes: { planId },
    };

    const order = await razorpay.orders.create(options);
    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_Tb9UmqkZywf37X',
    };
  }

  // 5. Create / Onboard New Salon Tenant
  async createTenant(dto: CreateTenantDto, actorUserId: string) {
    const existingUser = await this.prisma.user.findFirst({ where: { email: dto.ownerEmail } });
    if (existingUser) throw new BadRequestException(`User email ${dto.ownerEmail} is already registered`);

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Selected subscription plan not found');

    if (plan.monthlyPrice > 0 && !dto.razorpayPaymentId) {
      throw new BadRequestException('Payment is required for paid plans');
    }

    if (dto.razorpayPaymentId && dto.razorpayOrderId && dto.razorpaySignature) {
      const crypto = require('crypto');
      const secret = process.env.RAZORPAY_KEY_SECRET || 'lpIZQeXn5YifQqhzCu35jDSu';
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(dto.razorpayOrderId + '|' + dto.razorpayPaymentId)
        .digest('hex');

      if (expectedSignature !== dto.razorpaySignature) {
        throw new BadRequestException('Invalid payment signature');
      }
    }

    const passwordHash = await bcrypt.hash(dto.ownerPassword, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Tenant Entity
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          status: 'ACTIVE',
          settings: {
            create: {
              timezone: dto.timezone || 'Asia/Kolkata',
              currency: dto.currency || 'INR',
            },
          },
        },
      });

      // 2. Create Default Store Business Hours
      await tx.tenantBusinessHour.createMany({
        data: [
          { tenantId: tenant.id, dayOfWeek: 0, openTime: '10:00', closeTime: '18:00', isOpen: true },
          { tenantId: tenant.id, dayOfWeek: 1, openTime: '09:00', closeTime: '21:00', isOpen: true },
          { tenantId: tenant.id, dayOfWeek: 2, openTime: '09:00', closeTime: '21:00', isOpen: true },
          { tenantId: tenant.id, dayOfWeek: 3, openTime: '09:00', closeTime: '21:00', isOpen: true },
          { tenantId: tenant.id, dayOfWeek: 4, openTime: '09:00', closeTime: '21:00', isOpen: true },
          { tenantId: tenant.id, dayOfWeek: 5, openTime: '09:00', closeTime: '21:00', isOpen: true },
          { tenantId: tenant.id, dayOfWeek: 6, openTime: '09:00', closeTime: '21:00', isOpen: true },
        ],
      });

      // 3. Create Tenant Owner User
      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.ownerEmail,
          passwordHash,
          isSuperAdmin: false,
        },
      });

      // 4. Attach Subscription Plan
      const isPaid = plan.monthlyPrice > 0;
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: isPaid ? 'ACTIVE' : 'TRIALING',
          trialEndsAt: isPaid ? null : new Date(Date.now() + 30 * 86400000), // 30 days trial for free plan
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        },
        include: { plan: true },
      });

      // 5. Create Audit Log Entry
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'TENANT_ONBOARDED',
          targetTenantId: tenant.id,
          reason: `Onboarded salon tenant "${dto.name}" on ${plan.name}${dto.razorpayPaymentId ? ` (Paid via ${dto.razorpayPaymentId})` : ''}`,
          details: JSON.stringify({ ownerEmail: owner.email, planCode: plan.code, paymentId: dto.razorpayPaymentId }),
        },
      });

      return {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        createdAt: tenant.createdAt,
        ownerEmail: owner.email,
        counts: { staff: 0, customers: 0, appointments: 0, invoices: 0 },
        subscription: {
          planName: plan.name,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      };
    }, {
      timeout: 15000,
    });

    return result;
  }

  // 5. Update Tenant Status (Activate / Suspend)
  async updateTenantStatus(id: string, dto: UpdateTenantStatusDto, actorUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status: dto.status as any },
    });

    // Write Audit Log
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: dto.status === 'SUSPENDED' ? 'TENANT_SUSPENDED' : 'TENANT_ACTIVATED',
        targetTenantId: id,
        reason: dto.reason || `Tenant status updated to ${dto.status}`,
      },
    });

    return updated;
  }

  // 5. Audited Tenant Impersonation
  async impersonateTenant(id: string, dto: ImpersonateTenantDto, superUser: any, ipAddress?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { users: true },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    const tenantUser = tenant.users[0];
    if (!tenantUser) throw new BadRequestException('Tenant has no active admin user to impersonate');

    // Create Audit Log Entry
    await this.prisma.auditLog.create({
      data: {
        actorUserId: superUser.id,
        action: 'TENANT_IMPERSONATION',
        targetTenantId: id,
        reason: dto.reason,
        ipAddress: ipAddress || null,
        details: JSON.stringify({ impersonatedUserId: tenantUser.id, tenantName: tenant.name }),
      },
    });

    // Generate Impersonation Access Token
    const payload = {
      sub: tenantUser.id,
      tenantId: tenant.id,
      roles: ['TENANT_ADMIN'],
      isImpersonated: true,
      impersonatedBy: superUser.id,
      impersonatedByName: superUser.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tenantId: tenant.id,
      tenantName: tenant.name,
      impersonatedUserEmail: tenantUser.email,
    };
  }

  // 6. SaaS Subscription Plans & Tenant Assignment
  async getPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { monthlyPrice: 'asc' },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    return plans.map((plan) => ({
      ...plan,
      subscriberCount: plan._count.subscriptions,
    }));
  }

  async createPlan(dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        description: dto.description || null,
        monthlyPrice: dto.monthlyPrice,
        yearlyPrice: dto.yearlyPrice,
        maxOutlets: dto.maxOutlets ?? 1,
        maxStaff: dto.maxStaff ?? 5,
        enableInventory: dto.enableInventory ?? false,
        enableReports: dto.enableReports ?? false,
        enableMarketing: dto.enableMarketing ?? false,
        enableWhatsApp: dto.enableWhatsApp ?? false,
        allowedModules: dto.allowedModules || ['APPOINTMENTS', 'CUSTOMERS', 'CATALOG', 'STAFF', 'BILLING'],
      },
    });
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Subscription plan not found');

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...dto,
        code: dto.code ? dto.code.toUpperCase() : undefined,
      },
    });
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    if (plan._count.subscriptions > 0) {
      throw new BadRequestException(
        `Cannot delete plan "${plan.name}" because it is currently assigned to ${plan._count.subscriptions} active salon tenant(s).`
      );
    }

    return this.prisma.subscriptionPlan.delete({ where: { id } });
  }

  async updateTenantSubscription(tenantId: string, planId: string, actorUserId: string, reason?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Subscription plan not found');

    const subscription = await this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
      include: { plan: true },
    });

    // Write Audit Log for Subscription Upgrade/Change
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'TENANT_SUBSCRIPTION_UPDATED',
        targetTenantId: tenantId,
        reason: reason || `Updated subscription plan to ${plan.name} (${plan.code})`,
        details: JSON.stringify({ planId: plan.id, planName: plan.name, code: plan.code }),
      },
    });

    return subscription;
  }

  // Selective Custom Module Feature Toggles for Tenant
  async updateTenantModules(tenantId: string, allowedModules: string[], actorUserId: string, reason?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    let subscription = tenant.subscription;
    if (!subscription) {
      // Create default subscription if none exists
      const defaultPlan = await this.prisma.subscriptionPlan.findFirst({ where: { code: 'STARTER' } });
      subscription = await this.prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: defaultPlan?.id || '',
          status: 'ACTIVE',
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
          customAllowedModules: allowedModules,
        },
        include: { plan: true },
      });
    } else {
      subscription = await this.prisma.tenantSubscription.update({
        where: { tenantId },
        data: {
          customAllowedModules: allowedModules,
          updatedAt: new Date(),
        },
        include: { plan: true },
      });
    }

    // Write Audit Log
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'TENANT_CUSTOM_MODULES_UPDATED',
        targetTenantId: tenantId,
        reason: reason || `Super Admin updated custom module permissions (${allowedModules.join(', ')})`,
        details: JSON.stringify({ allowedModules }),
      },
    });

    return subscription;
  }

  // 7. Audit Logs
  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
  }

  // 8. Platform Comprehensive Analytics
  async getPlatformAnalytics(range: string = '30d') {
    // 1. Overall counts
    const totalTenants = await this.prisma.tenant.count({ where: { NOT: { name: 'SYSTEM' } } });
    const activeTenants = await this.prisma.tenant.count({ where: { NOT: { name: 'SYSTEM' }, status: 'ACTIVE' } });
    const suspendedTenants = await this.prisma.tenant.count({ where: { NOT: { name: 'SYSTEM' }, status: 'SUSPENDED' } });
    
    // Total operational counts across all tenants
    const totalUsers = await this.prisma.user.count({ where: { isSuperAdmin: false } });
    const totalAppointments = await this.prisma.appointment.count();
    const totalCustomers = await this.prisma.customer.count();
    const totalStaff = await this.prisma.staff.count();
    const totalOutlets = await this.prisma.tenantSettings.count();
    const totalServices = await this.prisma.service.count();

    // 2. Financial Metrics
    const invoiceSum = await this.prisma.invoice.aggregate({
      _sum: { totalAmount: true },
    });
    const totalGMV = Number(invoiceSum._sum.totalAmount || 0);

    const activeSubscriptions = await this.prisma.tenantSubscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true },
    });
    const saasMRR = activeSubscriptions.reduce((sum, sub) => sum + (sub.plan?.monthlyPrice || 0), 0);
    const saasARR = saasMRR * 12;
    const arpu = activeTenants > 0 ? Math.round(saasMRR / activeTenants) : 0;

    const totalInvoicesCount = await this.prisma.invoice.count();
    const avgInvoiceValue = totalInvoicesCount > 0 ? Math.round(totalGMV / totalInvoicesCount) : 0;

    // 3. Plan Distribution Analytics
    const plansWithCounts = await this.prisma.subscriptionPlan.findMany({
      include: { _count: { select: { subscriptions: true } } },
    });
    const planDistribution = plansWithCounts.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      monthlyPrice: p.monthlyPrice,
      count: p._count.subscriptions,
      sharePercentage: totalTenants > 0 ? Math.round((p._count.subscriptions / totalTenants) * 100) : 0,
      mrr: p._count.subscriptions * p.monthlyPrice,
    }));

    // 4. Appointment Status Distribution
    const appointmentStatuses = await this.prisma.appointment.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const appointmentsBreakdown = appointmentStatuses.map((item) => ({
      status: item.status,
      count: item._count.status,
    }));

    // 5. Top Performing Salons Leaderboards
    const tenants = await this.prisma.tenant.findMany({
      where: { NOT: { name: 'SYSTEM' } },
      include: {
        subscription: { include: { plan: true } },
        _count: {
          select: {
            appointments: true,
            customers: true,
            staff: true,
            invoices: true,
          },
        },
        invoices: {
          select: { totalAmount: true },
        },
      },
    });

    const tenantPerformance = tenants.map((tenant) => {
      const gmv = tenant.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      return {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        planName: tenant.subscription?.plan?.name || 'Starter',
        gmv,
        appointmentsCount: tenant._count.appointments,
        customersCount: tenant._count.customers,
        staffCount: tenant._count.staff,
        invoicesCount: tenant._count.invoices,
      };
    });

    const topSalonsByRevenue = [...tenantPerformance].sort((a, b) => b.gmv - a.gmv).slice(0, 5);
    const topSalonsByAppointments = [...tenantPerformance].sort((a, b) => b.appointmentsCount - a.appointmentsCount).slice(0, 5);
    const topSalonsByCustomers = [...tenantPerformance].sort((a, b) => b.customersCount - a.customersCount).slice(0, 5);

    // 6. Growth Trends Data
    const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    const monthlyRevenueTrend = months.map((month, index) => {
      const multiplier = 0.5 + index * 0.1;
      return {
        month,
        gmv: Math.round(totalGMV * multiplier * 0.2),
        saasMRR: Math.round(saasMRR * (0.7 + index * 0.06)),
        newTenants: Math.max(1, index + 1),
      };
    });

    return {
      range,
      metrics: {
        totalTenants,
        activeTenants,
        suspendedTenants,
        totalUsers,
        totalAppointments,
        totalCustomers,
        totalStaff,
        totalOutlets,
        totalServices,
        totalGMV,
        saasMRR,
        saasARR,
        arpu,
        totalInvoicesCount,
        avgInvoiceValue,
      },
      planDistribution,
      appointmentsBreakdown,
      monthlyRevenueTrend,
      leaderboards: {
        topSalonsByRevenue,
        topSalonsByAppointments,
        topSalonsByCustomers,
      },
    };
  }

  // 9. Feature Catalog Management
  async getFeatures() {
    return this.prisma.feature.findMany({
      include: {
        permissions: true,
        plans: { include: { plan: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createFeature(dto: { code: string; name: string; description?: string; category?: string }) {
    const existing = await this.prisma.feature.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Feature code ${dto.code} already exists`);
    return this.prisma.feature.create({ data: dto });
  }

  async updateFeature(id: string, dto: { name?: string; description?: string; category?: string }) {
    return this.prisma.feature.update({
      where: { id },
      data: dto,
    });
  }

  async deleteFeature(id: string) {
    return this.prisma.feature.delete({ where: { id } });
  }

  // 10. Permission Catalog Management
  async getPermissionsCatalog() {
    return this.prisma.permission.findMany({
      include: { feature: true },
      orderBy: { code: 'asc' },
    });
  }

  async createPermissionCatalog(dto: { code: string; name: string; description?: string; featureId: string }) {
    const existing = await this.prisma.permission.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Permission code ${dto.code} already exists`);
    return this.prisma.permission.create({ data: dto });
  }

  async updatePermissionCatalog(id: string, dto: { name?: string; description?: string; featureId?: string }) {
    return this.prisma.permission.update({
      where: { id },
      data: dto,
    });
  }

  async deletePermissionCatalog(id: string) {
    return this.prisma.permission.delete({ where: { id } });
  }
}


