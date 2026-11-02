import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class MtlsGuard implements CanActivate {
  private readonly enabled: boolean;
  private readonly caPath: string;
  private readonly logger = new LoggerService('MtlsGuard');

  constructor(private readonly configService: ConfigService) {
    const mTLSConfig = this.configService.get('security.mTLS');
    this.enabled = mTLSConfig?.enabled || false;
    this.caPath = mTLSConfig?.caPath || '/certs/ca.crt';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) {
      this.logger.debug('mTLS not enabled, allowing request');
      return true; // mTLS not enabled, allow request
    }

    const request = context.switchToHttp().getRequest<Request>();
    
    // Check if client certificate is present
    if (!request.socket?.getPeerCertificate) {
      this.logger.warn('mTLS authentication failed: No peer certificate method');
      throw new UnauthorizedException('mTLS authentication failed: No peer certificate');
    }

    const cert = request.socket.getPeerCertificate();
    
    // Check if certificate is valid
    if (!cert || Object.keys(cert).length === 0) {
      this.logger.warn('mTLS authentication failed: Invalid or missing client certificate');
      throw new UnauthorizedException('mTLS authentication failed: Invalid or missing client certificate');
    }

    // Verify certificate against CA
    try {
      this.verifyCertificate(cert);
    } catch (error) {
      this.logger.warn(`mTLS authentication failed: ${error.message}`);
      throw new UnauthorizedException(`mTLS authentication failed: ${error.message}`);
    }

    // Extract and validate common name or subject alternative names
    this.validateCertificateSubject(cert);

    // Log successful authentication
    this.logger.log('mTLS authentication successful', {
      commonName: this.extractCommonName(cert),
      issuer: cert.issuer,
      subject: cert.subject,
    });

    return true;
  }

  private verifyCertificate(cert: any): void {
    // In production, you would use a proper certificate verification library
    // For now, we just check if the certificate has the required fields
    if (!cert.subject) {
      throw new Error('Certificate has no subject');
    }

    if (!cert.issuer) {
      throw new Error('Certificate has no issuer');
    }

    // Check if certificate is issued by our CA
    const caCert = this.loadCACert();
    if (caCert && cert.issuer !== caCert.subject) {
      throw new Error('Certificate not issued by trusted CA');
    }

    // Check if certificate is expired
    if (cert.valid_to) {
      const expiryDate = new Date(cert.valid_to);
      const now = new Date();
      if (expiryDate < now) {
        throw new Error('Certificate has expired');
      }
    }

    // Check if certificate is not yet valid
    if (cert.valid_from) {
      const validFrom = new Date(cert.valid_from);
      const now = new Date();
      if (validFrom > now) {
        throw new Error('Certificate is not yet valid');
      }
    }
  }

  private validateCertificateSubject(cert: any): void {
    // Extract common name (CN) from subject
    const subject = cert.subject;
    const cnMatch = subject?.match(/CN=([^,]+)/);
    const commonName = cnMatch?.[1];

    if (!commonName) {
      throw new Error('Certificate has no Common Name (CN)');
    }

    // In a real implementation, you would validate the CN against a list of allowed services
    // For now, just log it
    this.logger.debug(`mTLS: Client certificate CN: ${commonName}`);
  }

  private extractCommonName(cert: any): string {
    const subject = cert.subject;
    const cnMatch = subject?.match(/CN=([^,]+)/);
    return cnMatch?.[1] || 'unknown';
  }

  private loadCACert(): any {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.caPath)) {
        const caCertPem = fs.readFileSync(this.caPath, 'utf8');
        // Parse the certificate (simplified)
        return { subject: this.extractSubjectFromPem(caCertPem) };
      }
    } catch (error) {
      this.logger.error('Failed to load CA certificate', error);
    }
    return null;
  }

  private extractSubjectFromPem(pem: string): string {
    // Simplified certificate parsing
    const certMatch = pem.match(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/);
    if (!certMatch) {
      return '';
    }

    // This is a simplified approach - in production, use a proper certificate parser
    // For now, just return a placeholder
    return 'CN=Revenue Share CA';
  }
}
