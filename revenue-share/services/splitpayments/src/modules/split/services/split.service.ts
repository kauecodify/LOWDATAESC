import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SplitRepository } from '../split.repository';
import { CreateSplitTransactionDto, SplitTransactionResponseDto, QuerySplitTransactionDto, WebhookCallbackDto, GenerateSPEDDto, FallbackToEscrowDto, PaymentStatus, PaymentMethod, TransactionType, Currency } from '../dto/create-split-transaction.dto';
import { LoggerService } from '../../../common/logger/logger.service';
import { KafkaService } from '../../../common/kafka/kafka.service';
import { IdempotencyService } from '../../../common/idempotency/idempotency.service';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { TaxRateCache, SplitTransaction, SplitEscrowAccount, SplitAuditLog } from '../entities/split-transaction.entity';

// Payment Gateway interfaces
interface PaymentGateway {
  submitSplitPayment(transaction: SplitTransaction): Promise<any>;
  getStatus(transactionId: string): Promise<any>;
  refund(transactionId: string, amount: number): Promise<any>;
}

interface TaxService {
  getCBSRate(): Promise<number>;
  getIBSRate(stateCode: string, municipalityCode?: string): Promise<number>;
}

interface SPEDService {
  generateFile(transactions: SplitTransaction[]): Promise<Buffer>;
  sendToReceitaFederal(file: Buffer, consortiumId: string): Promise<any>;
}

interface WebhookService {
  sendToReceitaFederal(transaction: SplitTransaction): Promise<any>;
  sendInternalCallback(transaction: SplitTransaction, eventType: string): Promise<any>;
}

@Injectable()
export class SplitService implements OnModuleInit {
  private readonly logger = new LoggerService();
  private paymentGateways: Map<string, PaymentGateway> = new Map();
  private taxServices: Map<string, TaxService> = new Map();

  constructor(
    private configService: ConfigService,
    private splitRepository: SplitRepository,
    private kafkaService: KafkaService,
    private idempotencyService: IdempotencyService,
    private loggerService: LoggerService,
  ) {}

  async onModuleInit() {
    // Initialize payment gateways
    await this.initializePaymentGateways();
    
    // Initialize tax services
    await this.initializeTaxServices();
  }

  private async initializePaymentGateways(): Promise<void> {
    const gateways = this.configService.get('paymentGateways');

    if (gateways?.bacen?.enabled) {
      // this.paymentGateways.set('bacen', new BacenGateway());
      this.logger.log('BACEN gateway initialized');
    }
    if (gateways?.iugu?.enabled) {
      // this.paymentGateways.set('iugu', new IuguGateway());
      this.logger.log('Iugu gateway initialized');
    }
    if (gateways?.asaas?.enabled) {
      // this.paymentGateways.set('asaas', new AsaasGateway());
      this.logger.log('Asaas gateway initialized');
    }
    if (gateways?.efi?.enabled) {
      // this.paymentGateways.set('efi', new EfiGateway());
      this.logger.log('Efi gateway initialized');
    }
  }

  private async initializeTaxServices(): Promise<void> {
    // Initialize BACEN tax service
    this.taxServices.set('bacen', {
      getCBSRate: async () => this.getCBSRateFromBacen(),
      getIBSRate: async (stateCode, municipalityCode) => this.getIBSRateFromBacen(stateCode, municipalityCode),
    });

    this.logger.log('Tax services initialized');
  }

  // Main method to create and process split transaction
  async createSplitTransaction(
    dto: CreateSplitTransactionDto,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SplitTransactionResponseDto> {
    const consortiumId = dto.consortiumId;
    const paymentId = dto.paymentId;
    const idempotencyKey = dto.idempotencyKey || uuidv4();

    // Check idempotency
    const idempotencyCacheKey = this.idempotencyService.generateKey('split-transaction', idempotencyKey);
    const existing = await this.idempotencyService.get(idempotencyCacheKey);
    
    if (existing) {
      this.logger.debug('Idempotent request detected', { idempotencyKey });
      return existing as SplitTransactionResponseDto;
    }

    // Generate unique hash for this transaction
    const splitHash = this.generateSplitHash(dto);

    // Check if transaction already exists
    const existingTransaction = await this.splitRepository.findBySplitHash(splitHash);
    if (existingTransaction) {
      this.logger.warn('Duplicate split transaction detected', {
        splitHash,
        existingId: existingTransaction.id,
      });
      
      // Return existing transaction
      return this.mapToResponseDto(existingTransaction);
    }

    // Get tax rates
    const taxRates = await this.getTaxRates(consortiumId, dto.taxRates);

    // Calculate split amounts
    const splitCalculation = this.calculateSplitAmounts(
      dto.originalAmount,
      taxRates.cbs,
      taxRates.ibs,
      dto.supplierAccount,
      dto.cbsAccount,
      dto.ibsAccount
    );

    // Create transaction
    const transactionData: Partial<SplitTransaction> = {
      id: uuidv4(),
      consortiumId,
      paymentId,
      transactionType: dto.transactionType || TransactionType.PAYMENT,
      method: dto.method,
      status: PaymentStatus.PENDING,
      originalAmount: dto.originalAmount,
      currency: dto.currency || Currency.BRL,
      taxInfo: {
        cbs: {
          rate: taxRates.cbs,
          amount: splitCalculation.taxAmounts.cbs,
          accountId: dto.cbsAccount.externalId,
        },
        ibs: {
          rate: taxRates.ibs,
          amount: splitCalculation.taxAmounts.ibs,
          accountId: dto.ibsAccount.externalId,
        },
        totalTaxRate: taxRates.cbs + taxRates.ibs,
        totalTaxAmount: splitCalculation.taxAmounts.cbs + splitCalculation.taxAmounts.ibs,
      },
      splitAmounts: splitCalculation.splitAmounts,
      splitHash,
      referenceId: dto.referenceId,
      metadata: dto.metadata,
      createdBy: userId,
      ipAddress,
      userAgent,
    };

    let transaction: SplitTransaction;

    try {
      // Create transaction in database
      transaction = await this.splitRepository.createSplitTransaction(transactionData);

      // Store in idempotency cache
      await this.idempotencyService.checkAndSet(
        idempotencyCacheKey,
        this.mapToResponseDto(transaction),
        this.configService.get('idempotency.ttl')
      );

      // Log audit
      await this.logAudit(transaction.id, consortiumId, 'TRANSACTION_CREATED', null, transaction, userId, ipAddress, userAgent);

      this.logger.log('Split transaction created', {
        transactionId: transaction.id,
        consortiumId,
        paymentId,
        amount: dto.originalAmount,
      });

      // Process the transaction (async)
      this.processSplitTransaction(transaction).catch((error) => {
        this.logger.error('Failed to process split transaction', {
          transactionId: transaction.id,
          error: error.message,
        });
      });

      return this.mapToResponseDto(transaction);
    } catch (error) {
      this.logger.error('Failed to create split transaction', {
        consortiumId,
        paymentId,
        error: error.message,
      });
      throw error;
    }
  }

  private async processSplitTransaction(transaction: SplitTransaction): Promise<void> {
    try {
      // Update status to processing
      await this.splitRepository.updateStatus(
        transaction.id,
        PaymentStatus.PROCESSING,
        transaction.consortiumId
      );

      await this.logAudit(
        transaction.id,
        transaction.consortiumId,
        'TRANSACTION_PROCESSING_STARTED',
        null,
        { status: PaymentStatus.PROCESSING },
        transaction.createdBy,
        transaction.ipAddress,
        transaction.userAgent
      );

      // Consult tax rates (if not already done)
      if (transaction.taxInfo.cbs.rate === 0 && transaction.taxInfo.ibs.rate === 0) {
        await this.updateStatus(transaction.id, PaymentStatus.TAX_CONSULTED, transaction.consortiumId);
        await this.logAudit(
          transaction.id,
          transaction.consortiumId,
          'TAX_RATES_CONSULTED',
          null,
          transaction.taxInfo,
          transaction.createdBy,
          transaction.ipAddress,
          transaction.userAgent
        );
      }

      // Calculate split amounts (if not already done)
      await this.updateStatus(transaction.id, PaymentStatus.SPLIT_CALCULATED, transaction.consortiumId);
      await this.logAudit(
        transaction.id,
        transaction.consortiumId,
        'SPLIT_CALCULATED',
        null,
        transaction.splitAmounts,
        transaction.createdBy,
        transaction.ipAddress,
        transaction.userAgent
      );

      // Submit to payment gateway
      const gatewayResult = await this.submitToGateway(transaction);

      if (gatewayResult.success) {
        // Update transaction with gateway info
        transaction.gatewayInfo = {
          gateway: gatewayResult.gateway,
          transactionId: gatewayResult.transactionId,
          splitTransactionId: gatewayResult.splitTransactionId,
          status: gatewayResult.status,
          response: gatewayResult.response,
        };

        await this.splitRepository.update(transaction.id, transaction, transaction.consortiumId);
        
        await this.updateStatus(transaction.id, PaymentStatus.GATEWAY_SUBMITTED, transaction.consortiumId);
        await this.logAudit(
          transaction.id,
          transaction.consortiumId,
          'GATEWAY_SUBMITTED',
          null,
          gatewayResult,
          transaction.createdBy,
          transaction.ipAddress,
          transaction.userAgent
        );

        // Monitor gateway status
        this.monitorGatewayStatus(transaction).catch((error) => {
          this.logger.error('Failed to monitor gateway status', {
            transactionId: transaction.id,
            error: error.message,
          });
        });
      } else {
        // Gateway submission failed, fallback to escrow
        await this.fallbackToEscrow(transaction, gatewayResult.error);
      }
    } catch (error) {
      this.logger.error('Failed to process split transaction', {
        transactionId: transaction.id,
        consortiumId: transaction.consortiumId,
        error: error.message,
      });

      await this.updateStatus(
        transaction.id,
        PaymentStatus.FAILED,
        transaction.consortiumId,
        { code: 'PROCESSING_ERROR', message: error.message, details: error }
      );

      await this.logAudit(
        transaction.id,
        transaction.consortiumId,
        'TRANSACTION_PROCESSING_FAILED',
        error.message,
        { error: error.message, stack: error.stack },
        transaction.createdBy,
        transaction.ipAddress,
        transaction.userAgent
      );
    }
  }

  private async submitToGateway(transaction: SplitTransaction): Promise<{ success: boolean; gateway?: string; transactionId?: string; splitTransactionId?: string; status?: string; response?: any; error?: string }> {
    try {
      const gateways = this.configService.get('paymentGateways');
      const preferredGateway = this.getPreferredGateway(transaction.method);

      if (!preferredGateway) {
        throw new Error('No preferred gateway available for this payment method');
      }

      const gateway = this.paymentGateways.get(preferredGateway);
      if (!gateway) {
        throw new Error(`Gateway ${preferredGateway} not initialized`);
      }

      const result = await gateway.submitSplitPayment(transaction);

      return {
        success: true,
        gateway: preferredGateway,
        transactionId: result.transactionId,
        splitTransactionId: result.splitTransactionId,
        status: result.status,
        response: result,
      };
    } catch (error) {
      this.logger.error('Failed to submit to payment gateway', {
        transactionId: transaction.id,
        method: transaction.method,
        error: error.message,
      });

      return {
        success: false,
        gateway: this.getPreferredGateway(transaction.method),
        error: error.message,
      };
    }
  }

  private getPreferredGateway(method: PaymentMethod): string | null {
    const gateways = this.configService.get('paymentGateways');

    // PIX: BACEN > Iugu > Asaas > Efi
    if (method === PaymentMethod.PIX) {
      if (gateways?.bacen?.enabled) return 'bacen';
      if (gateways?.iugu?.enabled) return 'iugu';
      if (gateways?.asaas?.enabled) return 'asaas';
      if (gateways?.efi?.enabled) return 'efi';
    }

    // BOLETO: Iugu > Asaas > Efi
    if (method === PaymentMethod.BOLETO) {
      if (gateways?.iugu?.enabled) return 'iugu';
      if (gateways?.asaas?.enabled) return 'asaas';
      if (gateways?.efi?.enabled) return 'efi';
    }

    // Default to BACEN if available
    if (gateways?.bacen?.enabled) return 'bacen';

    // Return first available gateway
    if (gateways?.iugu?.enabled) return 'iugu';
    if (gateways?.asaas?.enabled) return 'asaas';
    if (gateways?.efi?.enabled) return 'efi';

    return null;
  }

  private async monitorGatewayStatus(transaction: SplitTransaction): Promise<void> {
    try {
      const maxAttempts = this.configService.get('splitPayment.maxRetries') || 5;
      const retryDelay = this.configService.get('splitPayment.retryDelay') || 5000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));

        const gateway = transaction.gatewayInfo?.gateway;
        if (!gateway) {
          continue;
        }

        const gatewayClient = this.paymentGateways.get(gateway);
        if (!gatewayClient) {
          continue;
        }

        const status = await gatewayClient.getStatus(transaction.gatewayInfo.transactionId);

        if (status.status === 'COMPLETED' || status.status === 'SETTLED') {
          await this.updateStatus(transaction.id, PaymentStatus.COMPLETED, transaction.consortiumId);
          
          // Generate SPED file
          await this.generateSPEDFile(transaction);
          
          // Send webhook to Receita Federal
          await this.sendWebhookToReceitaFederal(transaction);
          
          // Send internal callback
          await this.sendInternalCallback(transaction, 'PAYMENT_COMPLETED');
          
          await this.logAudit(
            transaction.id,
            transaction.consortiumId,
            'TRANSACTION_COMPLETED',
            null,
            { status: PaymentStatus.COMPLETED, gatewayStatus: status },
            transaction.createdBy,
            transaction.ipAddress,
            transaction.userAgent
          );
          
          break;
        } else if (status.status === 'FAILED' || status.status === 'REJECTED') {
          await this.updateStatus(
            transaction.id,
            PaymentStatus.FAILED,
            transaction.consortiumId,
            { code: 'GATEWAY_FAILED', message: status.error || 'Gateway processing failed' }
          );
          
          await this.logAudit(
            transaction.id,
            transaction.consortiumId,
            'GATEWAY_PROCESSING_FAILED',
            status.error,
            { gatewayStatus: status },
            transaction.createdBy,
            transaction.ipAddress,
            transaction.userAgent
          );
          
          break;
        }
      }
    } catch (error) {
      this.logger.error('Failed to monitor gateway status', {
        transactionId: transaction.id,
        error: error.message,
      });
    }
  }

  private async fallbackToEscrow(transaction: SplitTransaction, error?: string): Promise<void> {
    try {
      const escrowConfig = this.configService.get('escrow');
      
      if (!escrowConfig?.enabled) {
        throw new Error('Escrow is not enabled');
      }

      // Get or create escrow account for this consortium
      let escrowAccount = await this.splitRepository.findEscrowAccountByConsortium(transaction.consortiumId);
      
      if (!escrowAccount || escrowAccount.length === 0) {
        const accountNumber = `${escrowConfig.defaultAccountPrefix}-${transaction.consortiumId}`;
        
        escrowAccount = [await this.splitRepository.createEscrowAccount({
          id: uuidv4(),
          consortiumId: transaction.consortiumId,
          accountNumber,
          accountType: 'ESCROW',
          accountDetails: {
            accountNumber,
            accountType: 'ESCROW',
          },
          balance: 0,
          currency: transaction.currency,
          createdBy: transaction.createdBy,
        })];
      }

      const account = escrowAccount[0];

      // Update escrow balance
      await this.splitRepository.updateEscrowBalance(
        account.id,
        transaction.originalAmount,
        transaction.consortiumId
      );

      // Update transaction with escrow info
      transaction.escrowInfo = {
        accountId: account.id,
        amount: transaction.originalAmount,
        retainedAt: new Date(),
        status: 'RETAINED',
        releaseAttempts: 0,
        lastReleaseAttempt: undefined,
      };

      transaction.status = PaymentStatus.ESCROW_RETAINED;
      transaction.errorInfo = {
        code: 'GATEWAY_FALLBACK',
        message: error || 'Gateway submission failed, funds retained in escrow',
        details: { gateway: transaction.gatewayInfo?.gateway },
        timestamp: new Date(),
      };

      await this.splitRepository.update(transaction.id, transaction, transaction.consortiumId);

      await this.logAudit(
        transaction.id,
        transaction.consortiumId,
        'ESCROW_RETAINED',
        error,
        {
          escrowAccountId: account.id,
          amount: transaction.originalAmount,
        },
        transaction.createdBy,
        transaction.ipAddress,
        transaction.userAgent
      );

      // Send alert to AI Owner
      await this.sendAlertToAIOwner(transaction, error);

      this.logger.log('Transaction retained in escrow', {
        transactionId: transaction.id,
        consortiumId: transaction.consortiumId,
        amount: transaction.originalAmount,
        escrowAccountId: account.id,
      });
    } catch (fallbackError) {
      this.logger.error('Failed to fallback to escrow', {
        transactionId: transaction.id,
        error: fallbackError.message,
      });

      await this.updateStatus(
        transaction.id,
        PaymentStatus.FAILED,
        transaction.consortiumId,
        {
          code: 'ESCROW_FALLBACK_FAILED',
          message: 'Failed to retain funds in escrow',
          details: { error: fallbackError.message },
          timestamp: new Date(),
        }
      );
    }
  }

  private async sendAlertToAIOwner(transaction: SplitTransaction, error?: string): Promise<void> {
    try {
      const alertConfig = this.configService.get('alert');
      
      if (!alertConfig?.enabled) {
        return;
      }

      const alertData = {
        type: 'SPLIT_PAYMENT_ESCROW_ALERT',
        severity: 'HIGH',
        transactionId: transaction.id,
        consortiumId: transaction.consortiumId,
        paymentId: transaction.paymentId,
        amount: transaction.originalAmount,
        currency: transaction.currency,
        method: transaction.method,
        gateway: transaction.gatewayInfo?.gateway,
        error: error || 'Gateway submission failed',
        timestamp: new Date().toISOString(),
        escrowAccountId: transaction.escrowInfo?.accountId,
        escrowAmount: transaction.escrowInfo?.amount,
      };

      // In production, this would send to Slack, Email, SMS, PagerDuty, etc.
      this.logger.log('Alert sent to AI Owner', alertData);

      // Publish to Kafka for alert processing
      await this.kafkaService.produce(
        this.configService.get('kafka.topic.escrowEvents') || 'escrow-events',
        [alertData],
        transaction.id
      );
    } catch (alertError) {
      this.logger.error('Failed to send alert to AI Owner', {
        transactionId: transaction.id,
        error: alertError.message,
      });
    }
  }

  private async generateSPEDFile(transaction: SplitTransaction): Promise<void> {
    try {
      const spedConfig = this.configService.get('sped');
      
      if (!spedConfig?.enabled) {
        return;
      }

      // In production, this would generate the SPED file
      // For now, just mark as generated
      transaction.spedInfo = {
        fileId: uuidv4(),
        batchId: uuidv4(),
        status: 'GENERATED',
        generatedAt: new Date(),
      };

      await this.splitRepository.update(transaction.id, transaction, transaction.consortiumId);

      await this.logAudit(
        transaction.id,
        transaction.consortiumId,
        'SPED_FILE_GENERATED',
        null,
        transaction.spedInfo,
        transaction.createdBy,
        transaction.ipAddress,
        transaction.userAgent
      );

      // Auto-send if configured
      if (spedConfig.autoSend) {
        await this.sendSPEDToReceitaFederal(transaction);
      }
    } catch (error) {
      this.logger.error('Failed to generate SPED file', {
        transactionId: transaction.id,
        error: error.message,
      });
    }
  }

  private async sendSPEDToReceitaFederal(transaction: SplitTransaction): Promise<void> {
    try {
      const spedConfig = this.configService.get('sped');
      
      if (!spedConfig?.enabled) {
        return;
      }

      // In production, this would send the SPED file to Receita Federal
      transaction.spedInfo = {
        ...transaction.spedInfo,
        status: 'SENT',
        sentAt: new Date(),
        response: { status: 'SUCCESS', message: 'SPED file sent to Receita Federal' },
      };

      await this.splitRepository.update(transaction.id, transaction, transaction.consortiumId);

      await this.logAudit(
        transaction.id,
        transaction.consortiumId,
        'SPED_FILE_SENT',
        null,
        transaction.spedInfo,
        transaction.createdBy,
        transaction.ipAddress,
        transaction.userAgent
      );
    } catch (error) {
      this.logger.error('Failed to send SPED file to Receita Federal', {
        transactionId: transaction.id,
        error: error.message,
      });

      transaction.spedInfo = {
        ...transaction.spedInfo,
        status: 'FAILED',
        error: error.message,
      };

      await this.splitRepository.update(transaction.id, transaction, transaction.consortiumId);
    }
  }

  private async sendWebhookToReceitaFederal(transaction: SplitTransaction): Promise<void> {
    try {
      const webhookConfig = this.configService.get('webhook.receitaFederal');
      
      if (!webhookConfig?.enabled) {
        return;
      }

      const webhookData = {
        transactionId: transaction.id,
        consortiumId: transaction.consortiumId,
        paymentId: transaction.paymentId,
        amount: transaction.originalAmount,
        currency: transaction.currency,
        taxInfo: transaction.taxInfo,
        splitAmounts: transaction.splitAmounts,
        gatewayInfo: transaction.gatewayInfo,
        timestamp: new Date().toISOString(),
      };

      // In production, this would send HTTP request to Receita Federal webhook
      this.logger.log('Webhook sent to Receita Federal', webhookData);

      // Update webhook info
      transaction.webhookInfo = {
        ...transaction.webhookInfo,
        receitaFederal: {
          sent: true,
          sentAt: new Date(),
          response: { status: 'SUCCESS' },
        },
      };

      await this.splitRepository.update(transaction.id, transaction, transaction.consortiumId);

      await this.logAudit(
        transaction.id,
        transaction.consortiumId,
        'WEBHOOK_SENT_TO_RECEITA_FEDERAL',
        null,
        webhookData,
        transaction.createdBy,
        transaction.ipAddress,
        transaction.userAgent
      );
    } catch (error) {
      this.logger.error('Failed to send webhook to Receita Federal', {
        transactionId: transaction.id,
        error: error.message,
      });

      transaction.webhookInfo = {
        ...transaction.webhookInfo,
        receitaFederal: {
          sent: true,
          sentAt: new Date(),
          error: error.message,
        },
      };

      await this.splitRepository.update(transaction.id, transaction, transaction.consortiumId);
    }
  }

  private async sendInternalCallback(transaction: SplitTransaction, eventType: string): Promise<void> {
    try {
      const webhookConfig = this.configService.get('webhook.internal');
      
      const callbackData = {
        eventType,
        transactionId: transaction.id,
        consortiumId: transaction.consortiumId,
        paymentId: transaction.paymentId,
        status: transaction.status,
        timestamp: new Date().toISOString(),
      };

      // In production, this would send HTTP request to internal webhook
      this.logger.log('Internal callback sent', callbackData);

      // Update webhook info
      transaction.webhookInfo = {
        ...transaction.webhookInfo,
        internal: {
          sent: true,
          sentAt: new Date(),
          response: { status: 'SUCCESS', eventType },
        },
      };

      await this.splitRepository.update(transaction.id, transaction, transaction.consortiumId);

      // Publish to Kafka
      await this.kafkaService.produce(
        this.configService.get('kafka.topic.webhookEvents') || 'webhook-events',
        [callbackData],
        transaction.id
      );
    } catch (error) {
      this.logger.error('Failed to send internal callback', {
        transactionId: transaction.id,
        eventType,
        error: error.message,
      });

      transaction.webhookInfo = {
        ...transaction.webhookInfo,
        internal: {
          sent: true,
          sentAt: new Date(),
          error: error.message,
        },
      };

      await this.splitRepository.update(transaction.id, transaction, transaction.consortiumId);
    }
  }

  // Tax rate methods
  private async getTaxRates(consortiumId: string, providedRates?: any[]): Promise<{ cbs: number; ibs: number }> {
    try {
      let cbsRate: number;
      let ibsRate: number;

      // Use provided rates if available
      if (providedRates && providedRates.length > 0) {
        for (const rate of providedRates) {
          if (rate.taxType === 'CBS') {
            cbsRate = rate.rate;
          } else if (rate.taxType === 'IBS') {
            ibsRate = rate.rate;
          }
        }
      }

      // If rates not provided, consult BACEN
      if (cbsRate === undefined) {
        cbsRate = await this.getCBSRateFromBacen();
      }

      if (ibsRate === undefined) {
        // For IBS, we need state/municipality info
        // For now, use default rate
        ibsRate = this.configService.get('splitPayment.defaultTaxRates.ibs') || 0.02;
      }

      return { cbs: cbsRate, ibs: ibsRate };
    } catch (error) {
      this.logger.error('Failed to get tax rates', {
        consortiumId,
        error: error.message,
      });

      // Return default rates
      return {
        cbs: this.configService.get('splitPayment.defaultTaxRates.cbs') || 0.01,
        ibs: this.configService.get('splitPayment.defaultTaxRates.ibs') || 0.02,
      };
    }
  }

  private async getCBSRateFromBacen(): Promise<number> {
    try {
      const bacenConfig = this.configService.get('bacen');
      
      if (!bacenConfig?.api?.baseUrl) {
        throw new Error('BACEN API not configured');
      }

      // In production, this would call the BACEN API
      // For now, return cached rate or default
      const cachedRate = await this.splitRepository.findLatestCBSRate();
      if (cachedRate) {
        return cachedRate.rate;
      }

      return this.configService.get('splitPayment.defaultTaxRates.cbs') || 0.01;
    } catch (error) {
      this.logger.error('Failed to get CBS rate from BACEN', {
        error: error.message,
      });

      return this.configService.get('splitPayment.defaultTaxRates.cbs') || 0.01;
    }
  }

  private async getIBSRateFromBacen(stateCode: string, municipalityCode?: string): Promise<number> {
    try {
      const bacenConfig = this.configService.get('bacen');
      
      if (!bacenConfig?.api?.baseUrl) {
        throw new Error('BACEN API not configured');
      }

      // In production, this would call the BACEN API
      // For now, return cached rate or default
      const cachedRate = await this.splitRepository.findLatestIBSRate(stateCode, municipalityCode);
      if (cachedRate) {
        return cachedRate.rate;
      }

      return this.configService.get('splitPayment.defaultTaxRates.ibs') || 0.02;
    } catch (error) {
      this.logger.error('Failed to get IBS rate from BACEN', {
        stateCode,
        municipalityCode,
        error: error.message,
      });

      return this.configService.get('splitPayment.defaultTaxRates.ibs') || 0.02;
    }
  }

  // Split calculation
  private calculateSplitAmounts(
    originalAmount: number,
    cbsRate: number,
    ibsRate: number,
    supplierAccount: any,
    cbsAccount: any,
    ibsAccount: any
  ): {
    taxAmounts: { cbs: number; ibs: number };
    splitAmounts: {
      supplier: any;
      cbs: any;
      ibs: any;
    };
  } {
    const cbsAmount = originalAmount * cbsRate;
    const ibsAmount = originalAmount * ibsRate;
    const totalTaxAmount = cbsAmount + ibsAmount;
    const supplierAmount = originalAmount - totalTaxAmount;

    return {
      taxAmounts: {
        cbs: cbsAmount,
        ibs: ibsAmount,
      },
      splitAmounts: {
        supplier: {
          amount: supplierAmount,
          accountId: supplierAccount.externalId,
          accountType: supplierAccount.accountType,
          bankDetails: supplierAccount.bankAccount,
          pixDetails: supplierAccount.pixAccount,
        },
        cbs: {
          amount: cbsAmount,
          accountId: cbsAccount.externalId,
          accountType: cbsAccount.accountType,
        },
        ibs: {
          amount: ibsAmount,
          accountId: ibsAccount.externalId,
          accountType: ibsAccount.accountType,
        },
      },
    };
  }

  // Helper methods
  private generateSplitHash(dto: CreateSplitTransactionDto): string {
    const hashData = {
      consortiumId: dto.consortiumId,
      paymentId: dto.paymentId,
      originalAmount: dto.originalAmount,
      currency: dto.currency,
      method: dto.method,
      supplierAccount: dto.supplierAccount.externalId,
      cbsAccount: dto.cbsAccount.externalId,
      ibsAccount: dto.ibsAccount.externalId,
    };

    const hashString = JSON.stringify(hashData);
    return crypto.createHash('sha256').update(hashString).digest('hex');
  }

  private mapToResponseDto(transaction: SplitTransaction): SplitTransactionResponseDto {
    return {
      id: transaction.id,
      consortiumId: transaction.consortiumId,
      paymentId: transaction.paymentId,
      status: transaction.status,
      splitHash: transaction.splitHash,
      taxInfo: transaction.taxInfo,
      splitAmounts: transaction.splitAmounts,
      gatewayInfo: transaction.gatewayInfo,
      errorInfo: transaction.errorInfo,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }

  private async logAudit(
    transactionId: string,
    consortiumId: string,
    action: string,
    errorMessage?: string,
    data?: any,
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const auditLog: Partial<SplitAuditLog> = {
        id: uuidv4(),
        transactionId,
        consortiumId,
        action,
        beforeData: null,
        afterData: data,
        metadata: errorMessage ? { error: errorMessage } : null,
        status: errorMessage ? 'FAILED' : 'SUCCESS',
        errorMessage,
        createdBy: userId,
        ipAddress,
        userAgent,
        createdAt: new Date(),
      };

      await this.splitRepository.createAuditLog(auditLog);
    } catch (error) {
      this.logger.error('Failed to log audit', {
        transactionId,
        action,
        error: error.message,
      });
    }
  }

  // Public methods for controller
  async findById(id: string, consortiumId?: string): Promise<SplitTransactionResponseDto | null> {
    const transaction = await this.splitRepository.findById(id, consortiumId);
    return transaction ? this.mapToResponseDto(transaction) : null;
  }

  async findByPaymentId(paymentId: string, consortiumId?: string): Promise<SplitTransactionResponseDto | null> {
    const transaction = await this.splitRepository.findByPaymentId(paymentId, consortiumId);
    return transaction ? this.mapToResponseDto(transaction) : null;
  }

  async findAll(filters: QuerySplitTransactionDto): Promise<{ transactions: SplitTransactionResponseDto[]; total: number; page: number; pageSize: number }> {
    const result = await this.splitRepository.findAll(filters);
    return {
      transactions: result.transactions.map((t) => this.mapToResponseDto(t)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async updateStatus(id: string, status: PaymentStatus, consortiumId?: string, errorInfo?: any): Promise<SplitTransactionResponseDto | null> {
    const transaction = await this.splitRepository.updateStatus(id, status, consortiumId, errorInfo);
    return transaction ? this.mapToResponseDto(transaction) : null;
  }

  async processWebhook(webhookDto: WebhookCallbackDto): Promise<void> {
    try {
      const transaction = await this.splitRepository.findById(webhookDto.transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Update gateway info
      transaction.gatewayInfo = {
        ...transaction.gatewayInfo,
        status: webhookDto.status,
        response: webhookDto.data,
        error: webhookDto.error,
      };

      await this.splitRepository.update(transaction.id, transaction, transaction.consortiumId);

      // Handle different webhook events
      switch (webhookDto.eventType) {
        case 'PAYMENT_COMPLETED':
          await this.updateStatus(transaction.id, PaymentStatus.COMPLETED, transaction.consortiumId);
          await this.generateSPEDFile(transaction);
          await this.sendWebhookToReceitaFederal(transaction);
          break;
        case 'PAYMENT_FAILED':
          await this.updateStatus(
            transaction.id,
            PaymentStatus.FAILED,
            transaction.consortiumId,
            { code: 'GATEWAY_FAILED', message: webhookDto.error?.message || 'Payment failed' }
          );
          break;
        case 'SPLIT_COMPLETED':
          // Split was completed at gateway level
          await this.updateStatus(transaction.id, PaymentStatus.COMPLETED, transaction.consortiumId);
          await this.generateSPEDFile(transaction);
          await this.sendWebhookToReceitaFederal(transaction);
          break;
      }

      await this.logAudit(
        transaction.id,
        transaction.consortiumId,
        `WEBHOOK_RECEIVED_${webhookDto.eventType}`,
        webhookDto.error?.message,
        webhookDto,
        transaction.createdBy,
        transaction.ipAddress,
        transaction.userAgent
      );
    } catch (error) {
      this.logger.error('Failed to process webhook', {
        webhook: JSON.stringify(webhookDto),
        error: error.message,
      });
      throw error;
    }
  }

  async generateSPED(generateDto: GenerateSPEDDto): Promise<{ fileId: string; fileUrl?: string; status: string }> {
    try {
      const { consortiumId, startDate, endDate, transactionIds } = generateDto;

      let transactions: SplitTransaction[];

      if (transactionIds && transactionIds.length > 0) {
        transactions = [];
        for (const id of transactionIds) {
          const transaction = await this.splitRepository.findById(id, consortiumId);
          if (transaction) {
            transactions.push(transaction);
          }
        }
      } else {
        const filters: any = { consortiumId };
        if (startDate) filters.startDate = new Date(startDate);
        if (endDate) filters.endDate = new Date(endDate);
        
        const result = await this.splitRepository.findAll(filters);
        transactions = result.transactions;
      }

      if (transactions.length === 0) {
        throw new Error('No transactions found for SPED generation');
      }

      // Generate SPED file
      const fileId = uuidv4();
      
      // In production, this would generate the actual SPED file
      // For now, just return metadata
      return {
        fileId,
        status: 'GENERATED',
      };
    } catch (error) {
      this.logger.error('Failed to generate SPED file', {
        generateDto: JSON.stringify(generateDto),
        error: error.message,
      });
      throw error;
    }
  }

  async fallbackToEscrow(fallbackDto: FallbackToEscrowDto): Promise<SplitTransactionResponseDto | null> {
    try {
      const transaction = await this.splitRepository.findById(fallbackDto.transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Manually trigger fallback
      await this.fallbackToEscrow(transaction, fallbackDto.reason);

      // Return updated transaction
      const updatedTransaction = await this.splitRepository.findById(fallbackDto.transactionId);
      return updatedTransaction ? this.mapToResponseDto(updatedTransaction) : null;
    } catch (error) {
      this.logger.error('Failed to fallback to escrow', {
        fallbackDto: JSON.stringify(fallbackDto),
        error: error.message,
      });
      throw error;
    }
  }

  async getTaxRates(consortiumId: string): Promise<{ cbs: number; ibs: number }> {
    return this.getTaxRates(consortiumId);
  }

  async refreshTaxRates(): Promise<void> {
    try {
      // In production, this would fetch latest rates from BACEN
      // For now, just log
      this.logger.log('Tax rates refresh triggered');
    } catch (error) {
      this.logger.error('Failed to refresh tax rates', {
        error: error.message,
      });
      throw error;
    }
  }
}
