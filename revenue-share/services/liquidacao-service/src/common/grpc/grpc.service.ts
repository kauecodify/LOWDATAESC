import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { LoggerService } from '../logger/logger.service';
import * as fs from 'fs';
import * as path from 'path';

// Type definitions for gRPC services
export interface EscrowService {
  createEscrowAccount: (request: any, callback: (error: any, response: any) => void) => void;
  getEscrowAccount: (request: any, callback: (error: any, response: any) => void) => void;
  listEscrowAccounts: (request: any, callback: (error: any, response: any) => void) => void;
  depositFunds: (request: any, callback: (error: any, response: any) => void) => void;
  withdrawFunds: (request: any, callback: (error: any, response: any) => void) => void;
  transferFunds: (request: any, callback: (error: any, response: any) => void) => void;
  getBalance: (request: any, callback: (error: any, response: any) => void) => void;
  getTransactionHistory: (request: any, callback: (error: any, response: any) => void) => void;
  freezeAccount: (request: any, callback: (error: any, response: any) => void) => void;
  unfreezeAccount: (request: any, callback: (error: any, response: any) => void) => void;
  closeAccount: (request: any, callback: (error: any, response: any) => void) => void;
}

export interface SettlementService {
  createSettlementInstruction: (request: any, callback: (error: any, response: any) => void) => void;
  getSettlementInstruction: (request: any, callback: (error: any, response: any) => void) => void;
  listSettlementInstructions: (request: any, callback: (error: any, response: any) => void) => void;
  executeSettlement: (request: any, callback: (error: any, response: any) => void) => void;
  cancelSettlement: (request: any, callback: (error: any, response: any) => void) => void;
  getSettlementStatus: (request: any, callback: (error: any, response: any) => void) => void;
  reconcileSettlement: (request: any, callback: (error: any, response: any) => void) => void;
  getSettlementHistory: (request: any, callback: (error: any, response: any) => void) => void;
}

@Injectable()
export class GrpcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new LoggerService('GrpcService');
  private escrowClient: any;
  private settlementClient: any;
  private grpcServer: grpc.Server;
  private readonly configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  async onModuleInit() {
    await this.initialize();
  }

  onModuleDestroy() {
    this.shutdown();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize gRPC clients
      await this.initializeClients();
      
      // Initialize gRPC server for callbacks
      await this.initializeServer();
      
      this.logger.log('gRPC service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize gRPC service', error);
      throw error;
    }
  }

  private async initializeClients(): Promise<void> {
    const grpcConfig = this.configService.get('grpc.lowdataesc');
    const host = grpcConfig?.host || 'lowdataesc.company.com';
    const port = grpcConfig?.port || 50051;
    const ssl = grpcConfig?.ssl || false;

    // Load proto definitions
    const protoPath = path.resolve(__dirname, '../../../proto/lowdataesc.proto');
    
    if (!fs.existsSync(protoPath)) {
      throw new Error(`Proto file not found: ${protoPath}`);
    }

    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const lowdataesc = protoDescriptor.lowdataesc as any;
    const v1 = lowdataesc.v1 as any;

    // Create credentials
    let credentials: grpc.ChannelCredentials;
    if (ssl) {
      const caCert = fs.readFileSync(grpcConfig.caPath || '/certs/lowdataesc-ca.crt');
      const clientCert = fs.readFileSync(grpcConfig.certPath || '/certs/liquidacao-service.crt');
      const clientKey = fs.readFileSync(grpcConfig.keyPath || '/certs/liquidacao-service.key');
      
      credentials = grpc.credentials.createSsl(caCert, clientKey, clientCert);
    } else {
      credentials = grpc.credentials.createInsecure();
    }

    // Create channel
    const channel = new grpc.Channel(`${host}:${port}`, credentials, {
      'grpc.max_receive_message_length': 16 * 1024 * 1024, // 16MB
      'grpc.max_send_message_length': 16 * 1024 * 1024, // 16MB
      'grpc.keepalive_time_ms': 10000,
      'grpc.keepalive_timeout_ms': 5000,
      'grpc.keepalive_permit_without_calls': 1,
    });

    // Create clients
    this.escrowClient = new v1.EscrowService(channel);
    this.settlementClient = new v1.SettlementService(channel);

    this.logger.log('gRPC clients initialized', {
      host,
      port,
      ssl,
    });
  }

  private async initializeServer(): Promise<void> {
    const grpcConfig = this.configService.get('grpc.server');
    const host = grpcConfig?.host || '0.0.0.0';
    const port = grpcConfig?.port || 50052;
    const ssl = grpcConfig?.ssl || false;

    // Create server
    this.grpcServer = new grpc.Server({
      'grpc.max_receive_message_length': 16 * 1024 * 1024,
      'grpc.max_send_message_length': 16 * 1024 * 1024,
    });

    // Load proto definitions for server
    const protoPath = path.resolve(__dirname, '../../../proto/lowdataesc.proto');
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const lowdataesc = protoDescriptor.lowdataesc as any;
    const v1 = lowdataesc.v1 as any;

    // Add services to server
    this.grpcServer.addService(v1.CallbackService.service, {
      registerCallback: this.registerCallback.bind(this),
      unregisterCallback: this.unregisterCallback.bind(this),
      listCallbacks: this.listCallbacks.bind(this),
    });

    // Start server
    if (ssl) {
      const serverCert = fs.readFileSync('/certs/liquidacao-service.crt');
      const serverKey = fs.readFileSync('/certs/liquidacao-service.key');
      const caCert = fs.readFileSync('/certs/ca.crt');
      
      this.grpcServer.bindAsync(
        `${host}:${port}`,
        grpc.ServerCredentials.createSsl(caCert, [{
          cert_chain: serverCert,
          private_key: serverKey,
        }]),
        () => {
          this.grpcServer.start();
          this.logger.log('gRPC server started with SSL', {
            host,
            port,
          });
        },
      );
    } else {
      this.grpcServer.bindAsync(
        `${host}:${port}`,
        grpc.ServerCredentials.createInsecure(),
        () => {
          this.grpcServer.start();
          this.logger.log('gRPC server started without SSL', {
            host,
            port,
          });
        },
      );
    }
  }

  shutdown(): void {
    if (this.grpcServer) {
      this.grpcServer.forceShutdown();
      this.logger.log('gRPC server shut down');
    }
  }

  // ============================================================================
  // ESCROW SERVICE METHODS
  // ============================================================================

  async createEscrowAccount(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.escrowClient.createEscrowAccount(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC createEscrowAccount error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getEscrowAccount(accountId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.escrowClient.getEscrowAccount({ account_id: accountId }, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC getEscrowAccount error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async listEscrowAccounts(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.escrowClient.listEscrowAccounts(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC listEscrowAccounts error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async depositFunds(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.escrowClient.depositFunds(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC depositFunds error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async withdrawFunds(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.escrowClient.withdrawFunds(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC withdrawFunds error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async transferFunds(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.escrowClient.transferFunds(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC transferFunds error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getBalance(accountId: string, currency?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = { account_id: accountId };
      if (currency) {
        (request as any).currency = currency;
      }
      this.escrowClient.getBalance(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC getBalance error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getTransactionHistory(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.escrowClient.getTransactionHistory(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC getTransactionHistory error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async freezeAccount(accountId: string, reason: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.escrowClient.freezeAccount({ account_id: accountId, reason }, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC freezeAccount error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async unfreezeAccount(accountId: string, reason: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.escrowClient.unfreezeAccount({ account_id: accountId, reason }, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC unfreezeAccount error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async closeAccount(accountId: string, reason: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.escrowClient.closeAccount({ account_id: accountId, reason }, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC closeAccount error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // ============================================================================
  // SETTLEMENT SERVICE METHODS
  // ============================================================================

  async createSettlementInstruction(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.settlementClient.createSettlementInstruction(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC createSettlementInstruction error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getSettlementInstruction(instructionId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.settlementClient.getSettlementInstruction({ instruction_id: instructionId }, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC getSettlementInstruction error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async listSettlementInstructions(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.settlementClient.listSettlementInstructions(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC listSettlementInstructions error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async executeSettlement(instructionId: string, idempotencyKey: string, forceExecute: boolean = false): Promise<any> {
    return new Promise((resolve, reject) => {
      this.settlementClient.executeSettlement(
        { instruction_id: instructionId, idempotency_key: idempotencyKey, force_execute: forceExecute },
        (error: any, response: any) => {
          if (error) {
            this.logger.error('gRPC executeSettlement error', error);
            reject(error);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  async cancelSettlement(instructionId: string, reason: string, idempotencyKey: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.settlementClient.cancelSettlement(
        { instruction_id: instructionId, reason, idempotency_key: idempotencyKey },
        (error: any, response: any) => {
          if (error) {
            this.logger.error('gRPC cancelSettlement error', error);
            reject(error);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  async getSettlementStatus(instructionId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.settlementClient.getSettlementStatus({ instruction_id: instructionId }, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC getSettlementStatus error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async reconcileSettlement(instructionId: string, transactionId: string, idempotencyKey: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.settlementClient.reconcileSettlement(
        { instruction_id: instructionId, transaction_id: transactionId, idempotency_key: idempotencyKey },
        (error: any, response: any) => {
          if (error) {
            this.logger.error('gRPC reconcileSettlement error', error);
            reject(error);
          } else {
            resolve(response);
          }
        },
      );
    });
  }

  async getSettlementHistory(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.settlementClient.getSettlementHistory(request, (error: any, response: any) => {
        if (error) {
          this.logger.error('gRPC getSettlementHistory error', error);
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // ============================================================================
  // CALLBACK SERVICE METHODS (Server-side)
  // ============================================================================

  private callbacks: Map<string, any> = new Map();

  private registerCallback(call: any, callback: any): void {
    try {
      const callbackId = this.generateCallbackId();
      const request = call.request;

      this.callbacks.set(callbackId, {
        callback_url: request.callback_url,
        event_types: request.event_types,
        secret_token: request.secret_token,
        created_at: new Date().toISOString(),
      });

      callback(null, {
        callback_id: callbackId,
        callback_url: request.callback_url,
        event_types: request.event_types,
        created_at: new Date().toISOString(),
        idempotency_key: request.idempotency_key,
      });

      this.logger.log('Registered callback', { callbackId });
    } catch (error) {
      this.logger.error('Failed to register callback', error);
      callback(error, null);
    }
  }

  private unregisterCallback(call: any, callback: any): void {
    try {
      const request = call.request;
      const callbackId = request.callback_id;

      if (this.callbacks.has(callbackId)) {
        this.callbacks.delete(callbackId);
        callback(null, {
          callback_id: callbackId,
          is_unregistered: true,
          unregistered_at: new Date().toISOString(),
          idempotency_key: request.idempotency_key,
        });

        this.logger.log('Unregistered callback', { callbackId });
      } else {
        callback({
          code: grpc.status.NOT_FOUND,
          details: `Callback not found: ${callbackId}`,
        }, null);
      }
    } catch (error) {
      this.logger.error('Failed to unregister callback', error);
      callback(error, null);
    }
  }

  private listCallbacks(call: any, callback: any): void {
    try {
      const request = call.request;
      const page = request.pagination?.page || 1;
      const pageSize = request.pagination?.page_size || 100;

      const callbacks = Array.from(this.callbacks.values());
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const pageCallbacks = callbacks.slice(start, end);

      callback(null, {
        callbacks: pageCallbacks,
        pagination: {
          page,
          page_size: pageSize,
          total_items: callbacks.length,
          total_pages: Math.ceil(callbacks.length / pageSize),
        },
      });

      this.logger.log('Listed callbacks', {
        count: callbacks.length,
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('Failed to list callbacks', error);
      callback(error, null);
    }
  }

  private generateCallbackId(): string {
    return `cb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // CALLBACK NOTIFICATION METHODS
  // ============================================================================

  async notifyCallback(eventType: string, eventData: any): Promise<void> {
    const grpcConfig = this.configService.get('grpc.server');
    const lowdataescConfig = this.configService.get('lowdataesc.callback');

    if (!lowdataescConfig?.enabled) {
      this.logger.debug('Callback notifications are disabled');
      return;
    }

    for (const [callbackId, callback] of this.callbacks) {
      if (callback.event_types.includes(eventType)) {
        try {
          // In a real implementation, we would send HTTP POST to callback_url
          // For now, just log it
          this.logger.log('Sending callback notification', {
            callbackId,
            eventType,
            callbackUrl: callback.callback_url,
          });

          // TODO: Implement actual HTTP POST to callback URL
          // with proper signature verification
        } catch (error) {
          this.logger.error('Failed to send callback notification', {
            callbackId,
            eventType,
            error,
          });
        }
      }
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  getEscrowClient(): any {
    return this.escrowClient;
  }

  getSettlementClient(): any {
    return this.settlementClient;
  }

  getGrpcServer(): grpc.Server {
    return this.grpcServer;
  }

  isInitialized(): boolean {
    return !!this.escrowClient && !!this.settlementClient && !!this.grpcServer;
  }
}
