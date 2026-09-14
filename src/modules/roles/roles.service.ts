import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/database/prisma.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AssignUserRolesDto } from "./dto/assign-role.dto";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all available permissions in system
   */
  async getAllPermissions() {
    return this.prisma.permission.findMany({
      include: { feature: true },
      orderBy: { name: "asc" },
    });
  }


  /**
   * Create custom role for a tenant
   */
  async createRole(tenantId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Role with name "${dto.name}" already exists`);
    }

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: dto.name,
        permissions: {
          create: (dto.permissionIds || []).map((permissionId) => ({
            permissionId,
          })),
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return role;
  }

  /**
   * Get all roles for tenant
   */
  async findAllRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Get single role by ID
   */
  async findOneRole(id: string, tenantId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    return role;
  }

  /**
   * Update role & permission assignments
   */
  async updateRole(id: string, tenantId: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findUnique({
        where: { tenantId_name: { tenantId, name: dto.name } },
      });
      if (existing) {
        throw new ConflictException(`Role with name "${dto.name}" already exists`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds !== undefined) {
        // Clear existing permissions
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        // Add new permissions
        if (dto.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: dto.permissionIds.map((permissionId) => ({
              roleId: id,
              permissionId,
            })),
          });
        }
      }

      return tx.role.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
  }

  /**
   * Delete a role
   */
  async deleteRole(id: string, tenantId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException("Role not found");
    }

    if (role._count.users > 0) {
      throw new BadRequestException(
        `Cannot delete role "${role.name}" because it is currently assigned to ${role._count.users} user(s)`,
      );
    }

    return this.prisma.role.delete({
      where: { id },
    });
  }

  /**
   * Assign roles to a user
   */
  async assignRolesToUser(tenantId: string, dto: AssignUserRolesDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });

    if (!user) {
      throw new NotFoundException("User not found in this tenant");
    }

    // Verify all roleIds belong to this tenant
    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: dto.roleIds },
        tenantId,
      },
    });

    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException("One or more invalid role IDs for this tenant");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId: dto.userId },
      });

      if (dto.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({
            userId: dto.userId,
            roleId,
          })),
        });
      }
    });

    return this.getUserRoles(dto.userId, tenantId);
  }

  /**
   * Get roles assigned to a user
   */
  async getUserRoles(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
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
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      userId: user.id,
      email: user.email,
      roles: user.roles.map((ur) => ur.role),
    };
  }
}
