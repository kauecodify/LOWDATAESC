import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as fs from 'fs';
import * as https from 'https';

@Injectable()
export class MtlsGuard implements CanActivate {
  private readonly enabled: boolean;
  private readonly caPath: string;

  constructor(private readonly configService: ConfigService) {
    const mTLSConfig = this.configService.get('security.mTLS');
    this.enabled = mTLSConfig?.enabled || false;
    this.caPath = mTLSConfig?.caPath || '/certs/ca.crt';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enabled) {
      return true; // mTLS not enabled, allow request
    }

    const request = context.switchToHttp().getRequest<Request>();
    
    // Check if client certificate is present
    if (!request.socket?.getPeerCertificate) {
      throw new UnauthorizedException('mTLS authentication failed: No peer certificate');
    }

    const cert = request.socket.getPeerCertificate();
    
    // Check if certificate is valid
    if (!cert || Object.keys(cert).length === 0) {
      throw new UnauthorizedException('mTLS authentication failed: Invalid or missing client certificate');
    }

    // Verify certificate against CA
    try {
      this.verifyCertificate(cert);
    } catch (error) {
      throw new UnauthorizedException(`mTLS authentication failed: ${error.message}`);
    }

    // Extract and validate common name or subject alternative names
    this.validateCertificateSubject(cert);

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
    console.log(`mTLS: Client certificate CN: ${commonName}`);
  }

  private loadCACert(): any {
    try {
      if (fs.existsSync(this.caPath)) {
        const caCertPem = fs.readFileSync(this.caPath, 'utf8');
        // Parse the certificate (simplified)
        return { subject: this.extractSubjectFromPem(caCertPem) };
      }
    } catch (error) {
      console.error('Failed to load CA certificate:', error);
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
    const base64 = certMatch[1].replace(/\s+/g, '');
    const buffer = Buffer.from(base64, 'base64');
    const cert = buffer.toString('utf8');

    // Extract subject from certificate (this is a placeholder)
    // In a real implementation, use the 'x509' or similar library
    return 'CN=Revenue Share CA';
  }
}
