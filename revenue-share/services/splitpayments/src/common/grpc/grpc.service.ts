import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { LoggerService } from '../logger/logger.service';

interface GrpcClientConfig {
  host: string;
  port: number;
  ssl: boolean;
  caPath?: string;
  certPath?: string;
  keyPath?: string;
  timeout?: number;
}

@Injectable()
export class GrpcService implements OnModuleDestroy {
  private clients: Map<string, any> = new Map();
  private server: grpc.Server;
  private readonly logger = new LoggerService();

  constructor(private configService: ConfigService) {
    this.server = new grpc.Server();
  }

  async onModuleInit() {
    // Initialize LOWDATAESC gRPC client
    await this.initializeLowDataEscClient();
    
    // Start gRPC server for internal callbacks
    await this.startServer();
  }

  async onModuleDestroy() {
    // Close all clients
    for (const [name, client] of this.clients) {
      try {
        client.close();
        this.logger.log(`gRPC client closed: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to close gRPC client: ${name}`, error);
      }
    }
    this.clients.clear();

    // Stop server
    this.server.forceShutdown();
    this.logger.log('gRPC server stopped');
  }

  async initialize(): Promise<void> {
    await this.initializeLowDataEscClient();
  }

  private async initializeLowDataEscClient(): Promise<void> {
    try {
      const config = this.configService.get('grpc.lowdataesc');
      
      if (!config?.host) {
        this.logger.warn('LOWDATAESC gRPC configuration not found, skipping client initialization');
        return;
      }

      const clientConfig: GrpcClientConfig = {
        host: config.host,
        port: config.port || 50051,
        ssl: config.ssl === true,
        caPath: config.caPath,
        certPath: config.certPath,
        keyPath: config.keyPath,
        timeout: config.timeout || 10000,
      };

      const client = await this.createClient('lowdataesc', clientConfig);
      this.clients.set('lowdataesc', client);
      this.logger.log('LOWDATAESC gRPC client initialized');
    } catch (error) {
      this.logger.error('Failed to initialize LOWDATAESC gRPC client', error);
      throw error;
    }
  }

  private async createClient(name: string, config: GrpcClientConfig): Promise<any> {
    try {
      // Load proto definition
      const packageDefinition = await protoLoader.load(
        'lowdataesc.proto',
        {
          keepCase: true,
        }
      );

      // Load gRPC package definition
      const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

      // Create credentials
      let credentials: grpc.ChannelCredentials;
      if (config.ssl) {
        let sslCredentials = grpc.ChannelCredentials.createSsl();
        
        if (config.caPath) {
          const ca = require('fs').readFileSync(config.caPath);
          sslCredentials = grpc.ChannelCredentials.createSsl(ca);
        }
        
        if (config.certPath && config.keyPath) {
          const cert = require('fs').readFileSync(config.certPath);
          const key = require('fs').readFileSync(config.keyPath);
          sslCredentials = grpc.ChannelCredentials.createSsl(ca, key, cert);
        }
        
        credentials = sslCredentials;
      } else {
        credentials = grpc.ChannelCredentials.createInsecure();
      }

      // Create channel
      const channel = new grpc.Channel(
        `${config.host}:${config.port}`,
        credentials,
        {
          'grpc.default_authority': `${config.host}:${config.port}`,
          'grpc.ssl_target_name_override': config.host,
        }
      );

      // Set timeout
      const deadline = new Date();
      deadline.setMilliseconds(deadline.getMilliseconds() + (config.timeout || 10000));

      // Create client
      const client = new (protoDescriptor as any).LowDataEscService(
        channel,
        grpc.credentials.createInsecure()
      );

      return client;
    } catch (error) {
      this.logger.error(`Failed to create gRPC client: ${name}`, error);
      throw error;
    }
  }

  private async startServer(): Promise<void> {
    try {
      const serverConfig = this.configService.get('grpc.server');
      const host = serverConfig?.host || '0.0.0.0';
      const port = serverConfig?.port || 50053;
      const ssl = serverConfig?.ssl === true;

      if (ssl) {
        // SSL server configuration would go here
        this.logger.warn('gRPC SSL server not yet implemented');
      }

      // Start server
      this.server.bindAsync(
        `${host}:${port}`,
        ssl ? grpc.ServerCredentials.createSsl() : grpc.ServerCredentials.createInsecure(),
        () => {
          this.server.start();
          this.logger.log(`gRPC server started on ${host}:${port}`);
        }
      );
    } catch (error) {
      this.logger.error('Failed to start gRPC server', error);
      throw error;
    }
  }

  getClient(name: string): any {
    return this.clients.get(name);
  }

  getLowDataEscClient(): any {
    return this.clients.get('lowdataesc');
  }

  getServer(): grpc.Server {
    return this.server;
  }

  // Helper method to make gRPC calls with retry
  async callWithRetry(
    clientName: string,
    method: string,
    args: any,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<any> {
    const client = this.clients.get(clientName);
    if (!client) {
      throw new Error(`gRPC client not found: ${clientName}`);
    }

    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await new Promise((resolve, reject) => {
          client[method](args, (error, response) => {
            if (error) {
              reject(error);
            } else {
              resolve(response);
            }
          });
        });
        
        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn(`gRPC call failed, attempt ${attempt + 1}/${maxRetries}`, {
          client: clientName,
          method,
          error: error.message,
        });

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    throw lastError;
  }

  // Register service implementation
  addService(service: any, implementation: any): void {
    this.server.addService(service, implementation);
  }
}
