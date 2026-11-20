import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../logger/logger.service';
import * as fs from 'fs';
import * as https from 'https';

@Injectable()
export class MtlsGuard implements CanActivate {
  private readonly logger = new LoggerService();

  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const mtlsConfig = this.configService.get('security.mTLS');

    // If mTLS is not enabled, allow all requests
    if (!mtlsConfig?.enabled) {
      this.logger.debug('mTLS is not enabled, skipping certificate validation');
      return true;
    }

    // Check for client certificate
    if (!request.socket) {
      this.logger.error('No socket available for mTLS validation');
      throw new UnauthorizedException('Client certificate required');
    }

    const socket = request.socket as any;
    
    // For HTTPS connections
    if (socket.encrypted && socket.getPeerCertificate) {
      try {
        const cert = socket.getPeerCertificate();
        
        if (!cert) {
          this.logger.error('No client certificate provided');
          throw new UnauthorizedException('Client certificate required');
        }

        // Validate certificate
        await this.validateCertificate(cert);
        
        // Store certificate info in request for later use
        (request as any).clientCert = cert;
        
        this.logger.debug('mTLS certificate validated successfully', {
          subject: cert.subject?.CN,
          issuer: cert.issuer?.CN,
        });
        
        return true;
      } catch (error) {
        this.logger.error('mTLS validation failed', error);
        throw new UnauthorizedException('Invalid client certificate');
      }
    }

    // For non-HTTPS connections
    this.logger.error('Connection is not encrypted');
    throw new UnauthorizedException('Secure connection required');
  }

  private async validateCertificate(cert: any): Promise<void> {
    const mtlsConfig = this.configService.get('security.mTLS');
    
    // Check if certificate is expired
    if (cert.valid_to) {
      const expiryDate = new Date(cert.valid_to);
      const now = new Date();
      
      if (expiryDate < now) {
        throw new Error('Certificate has expired');
      }
    }

    // Check if certificate is revoked (simplified check)
    // In production, this would use a CRL or OCSP
    
    // Check if certificate is from a trusted CA
    if (mtlsConfig?.caPath) {
      try {
        const caCert = fs.readFileSync(mtlsConfig.caPath, 'utf8');
        // In production, we would verify the certificate chain
        // For now, just check if the issuer matches
        if (cert.issuer?.CN && !cert.issuer.CN.includes('LOWDATAESC')) {
          throw new Error('Certificate not issued by trusted CA');
        }
      } catch (error) {
        this.logger.error('Failed to validate CA', error);
        throw new Error('Certificate validation failed');
      }
    }

    // Check certificate subject
    if (!cert.subject?.CN) {
      throw new Error('Certificate subject is invalid');
    }

    // Additional validation can be added here
    // - Certificate revocation check
    // - Certificate fingerprint validation
    // - Certificate purpose validation
  }
}
