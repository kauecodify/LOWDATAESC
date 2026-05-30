import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { OpaClient } from '@open-policy-agent/opa-js';
import { Request } from 'express';

@Injectable()
export class JwtOpaGuard implements CanActivate {
  private opa = new OpaClient(process.env.OPA_URL);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    const input = {
      method: req.method,
      path: req.route.path,
      roles: req.user?.roles,
      tenantId: req.headers['x-tenant-id'],
    };

    const { result } = await this.opa.query('data.lowdataesc.allow', { input });
    return result === true;
  }
}
