import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../logger/logger.service';

// Metadata keys for RBAC
const ROLES_METADATA_KEY = 'roles';
const PERMISSIONS_METADATA_KEY = 'permissions';

export interface RBACMetadata {
  roles?: string[];
  permissions?: string[];
  requireAllRoles?: boolean;
  requireAllPermissions?: boolean;
}

@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new LoggerService('RbacGuard');

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = this.extractUser(request);

    if (!user) {
      this.logger.warn('RBAC: No user found in request', {
        path: request.path,
        method: request.method,
      });
      throw new UnauthorizedException('Authentication required');
    }

    // Check if user is active
    if (!user.isActive) {
      this.logger.warn('RBAC: User is inactive', { userId: user.id });
      throw new ForbiddenException('User is inactive');
    }

    // Get metadata from the route
    const rolesMetadata = this.reflector.get<string[]>(
      ROLES_METADATA_KEY,
      context.getHandler(),
    );
    const permissionsMetadata = this.reflector.get<string[]>(
      PERMISSIONS_METADATA_KEY,
      context.getHandler(),
    );

    const metadata: RBACMetadata = this.reflector.get<RBACMetadata>(
      'rbac',
      context.getHandler(),
    ) || {};

    // Check roles
    if (rolesMetadata || metadata.roles) {
      const requiredRoles = rolesMetadata || metadata.roles;
      const requireAll = metadata.requireAllRoles !== false;

      if (!this.checkRoles(user, requiredRoles, requireAll)) {
        this.logger.warn('RBAC: User does not have required roles', {
          userId: user.id,
          userRoles: user.roles,
          requiredRoles,
        });
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    // Check permissions
    if (permissionsMetadata || metadata.permissions) {
      const requiredPermissions = permissionsMetadata || metadata.permissions;
      const requireAll = metadata.requireAllPermissions !== false;

      if (!this.checkPermissions(user, requiredPermissions, requireAll)) {
        this.logger.warn('RBAC: User does not have required permissions', {
          userId: user.id,
          userPermissions: user.permissions,
          requiredPermissions,
        });
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }

  private extractUser(request: Request): any {
    // Extract user from JWT token (set by authentication middleware)
    return request.user || null;
  }

  private checkRoles(user: any, requiredRoles: string[], requireAll: boolean = true): boolean {
    if (!user.roles || user.roles.length === 0) {
      return false;
    }

    if (requireAll) {
      // User must have ALL required roles
      return requiredRoles.every((role) => user.roles.includes(role));
    } else {
      // User must have AT LEAST ONE required role
      return requiredRoles.some((role) => user.roles.includes(role));
    }
  }

  private checkPermissions(user: any, requiredPermissions: string[], requireAll: boolean = true): boolean {
    if (!user.permissions || user.permissions.length === 0) {
      return false;
    }

    if (requireAll) {
      // User must have ALL required permissions
      return requiredPermissions.every((permission) => 
        user.permissions.includes(permission)
      );
    } else {
      // User must have AT LEAST ONE required permission
      return requiredPermissions.some((permission) => 
        user.permissions.includes(permission)
      );
    }
  }
}

// Decorator to specify required roles
export function Roles(roles: string[], requireAll: boolean = true) {
  return SetMetadata(ROLES_METADATA_KEY, roles);
}

// Decorator to specify required permissions
export function Permissions(permissions: string[], requireAll: boolean = true) {
  return SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
}

// Decorator to specify RBAC metadata
export function Rbac(metadata: RBACMetadata) {
  return SetMetadata('rbac', metadata);
}

import { SetMetadata } from '@nestjs/common';
