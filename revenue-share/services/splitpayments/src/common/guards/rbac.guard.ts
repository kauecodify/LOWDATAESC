import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../logger/logger.service';

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface User {
  id: string;
  username: string;
  roles: Role[];
  tenantId?: string;
  isActive: boolean;
}

@Injectable()
export class RbacGuard implements CanActivate {
  private readonly logger = new LoggerService();

  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const requiredPermissions = this.getRequiredPermissions(context);

    // Extract user from request (set by authentication middleware)
    const user = (request as any).user as User;

    if (!user) {
      this.logger.error('No authenticated user found in request');
      throw new UnauthorizedException('Authentication required');
    }

    if (!user.isActive) {
      this.logger.error('User account is inactive', { userId: user.id });
      throw new ForbiddenException('Account inactive');
    }

    // Check if user has required permissions
    if (requiredPermissions.length > 0) {
      const userPermissions = this.getUserPermissions(user);
      
      for (const requiredPermission of requiredPermissions) {
        if (!userPermissions.includes(requiredPermission)) {
          this.logger.error('User lacks required permission', {
            userId: user.id,
            requiredPermission,
            userPermissions,
          });
          throw new ForbiddenException('Insufficient permissions');
        }
      }
    }

    // Check tenant access if applicable
    const tenantId = this.getTenantIdFromRequest(request);
    if (tenantId && user.tenantId && user.tenantId !== tenantId) {
      this.logger.error('User does not have access to this tenant', {
        userId: user.id,
        userTenant: user.tenantId,
        requestedTenant: tenantId,
      });
      throw new ForbiddenException('Access to this resource is restricted');
    }

    this.logger.debug('RBAC validation passed', {
      userId: user.id,
      permissions: requiredPermissions,
    });

    return true;
  }

  private getRequiredPermissions(context: ExecutionContext): string[] {
    const handler = context.getHandler();
    const controller = context.getClass();

    // Check for @Permissions decorator on handler
    const handlerPermissions = Reflect.getMetadata('permissions', handler);
    if (handlerPermissions) {
      return handlerPermissions as string[];
    }

    // Check for @Permissions decorator on controller
    const controllerPermissions = Reflect.getMetadata('permissions', controller);
    if (controllerPermissions) {
      return controllerPermissions as string[];
    }

    return [];
  }

  private getUserPermissions(user: User): string[] {
    const permissions: Set<string> = new Set();
    
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        permissions.add(permission);
      }
    }
    
    return Array.from(permissions);
  }

  private getTenantIdFromRequest(request: Request): string | null {
    // Check header
    const tenantHeader = this.configService.get('splitPayment.multiTenant.tenantHeader') || 'X-Consortium-Id';
    const tenantId = request.headers[tenantHeader.toLowerCase()] || request.headers[tenantHeader];
    
    if (tenantId) {
      return Array.isArray(tenantId) ? tenantId[0] : tenantId;
    }

    // Check query parameter
    if (request.query.tenantId) {
      return request.query.tenantId as string;
    }

    // Check body
    if ((request as any).body?.tenantId) {
      return (request as any).body.tenantId;
    }

    return null;
  }
}

// Decorator to specify required permissions
export function Permissions(...permissions: string[]) {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (propertyKey && descriptor) {
      // Method decorator
      Reflect.defineMetadata('permissions', permissions, descriptor.value);
    } else {
      // Class decorator
      Reflect.defineMetadata('permissions', permissions, target);
    }
  };
}
