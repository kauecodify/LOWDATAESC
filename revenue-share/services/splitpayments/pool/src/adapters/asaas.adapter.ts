import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../services/logger.service';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

interface AsaasConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  splitEnabled: boolean;
  splitEndpoint: string;
  webhookToken: string;
  timeout: number;
}

interface AsaasSplitPaymentRequest {
  customer: string;
  paymentDate: string;
  value: number;
  description: string;
  externalReference: string;
  split: {
    walletId: string;
    value: number;
  }[];
  paymentType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD';
  pixAddressKey?: string;
  dueDate?: string;
}

interface AsaasSplitPaymentResponse {
  id: string;
  customer: string;
  paymentDate: string;
  value: number;
  netValue: number;
  description: string;
  externalReference: string;
  status: string;
  split: any[];
  paymentType: string;
  dueDate: string;
  originalValue: number;
  interestValue: number;
  fineValue: number;
  pixTransactionId?: string;
}

@Injectable()
export class AsaasAdapter {
  private readonly logger = new LoggerService();
  private axiosInstance: AxiosInstance;
  private config: AsaasConfig;

  constructor(
    private configService: ConfigService,
    private poolLogger: LoggerService,
  ) {
    this.config = this.configService.get('paymentGateways.asaas');
    
    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.config.apiKey,
      },
    });
  }

  async submitSplitPayment(
    transaction: any
  ): Promise<{ success: boolean; transactionId?: string; splitTransactionId?: string; status?: string; response?: any; error?: string }> {
    try {
      if (!this.config.enabled || !this.config.splitEnabled) {
        throw new Error('Asaas split payment is not enabled');
      }

      // Map transaction to Asaas format
      const request = this.mapToAsaasFormat(transaction);

      const response = await this.axiosInstance.post<AsaasSplitPaymentResponse>(
        this.config.splitEndpoint,
        request
      );

      this.logger.log('Asaas split payment submitted', {
        transactionId: transaction.id,
        asaasTransactionId: response.data.id,
      });

      return {
        success: true,
        transactionId: response.data.id,
        splitTransactionId: response.data.id,
        status: response.data.status,
        response: response.data,
      };
    } catch (error) {
      this.logger.error('Asaas split payment submission failed', {
        transactionId: transaction.id,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  private mapToAsaasFormat(transaction: any): AsaasSplitPaymentRequest {
    // Create split rules
    const split = [];

    // Supplier (main recipient)
    split.push({
      walletId: transaction.supplierAccount.externalId,
      value: transaction.splitAmounts.supplier.amount,
    });

    // CBS
    split.push({
      walletId: transaction.taxInfo.cbs.accountId,
      value: transaction.taxInfo.cbs.amount,
    });

    // IBS
    split.push({
      walletId: transaction.taxInfo.ibs.accountId,
      value: transaction.taxInfo.ibs.amount,
    });

    // Determine payment method
    let paymentType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'DEBIT_CARD' = 'PIX';
    switch (transaction.method) {
      case 'PIX':
        paymentType = 'PIX';
        break;
      case 'BOLETO':
        paymentType = 'BOLETO';
        break;
      case 'CREDIT_CARD':
        paymentType = 'CREDIT_CARD';
        break;
      case 'DEBIT_CARD':
        paymentType = 'DEBIT_CARD';
        break;
      default:
        paymentType = 'PIX';
    }

    return {
      customer: transaction.supplierAccount.externalId,
      paymentDate: new Date().toISOString().split('T')[0],
      value: transaction.originalAmount,
      description: `Split Payment - ${transaction.id}`,
      externalReference: transaction.id,
      split,
      paymentType,
      dueDate: paymentType === 'BOLETO' ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
    };
  }

  async getStatus(transactionId: string): Promise<{ status: string; error?: string; data?: any }> {
    try {
      const response = await this.axiosInstance.get<AsaasSplitPaymentResponse>(
        `/payments/${transactionId}`
      );

      return {
        status: response.data.status,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('Failed to get Asaas transaction status', {
        transactionId,
        error: error.message,
      });

      return {
        status: 'FAILED',
        error: error.message,
      };
    }
  }

  async refund(transactionId: string, amount: number): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      const response = await this.axiosInstance.post<{ id: string }>(
        `/payments/${transactionId}/refund`,
        {
          value: amount,
        }
      );

      this.logger.log('Asaas refund initiated', {
        transactionId,
        amount,
        refundId: response.data.id,
      });

      return {
        success: true,
        refundId: response.data.id,
      };
    } catch (error) {
      this.logger.error('Failed to initiate Asaas refund', {
        transactionId,
        amount,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: 'HEALTHY' | 'UNHEALTHY'; error?: string }> {
    try {
      await this.axiosInstance.get('/health');
      return { status: 'HEALTHY' };
    } catch (error) {
      this.logger.error('Asaas health check failed', error);
      return { status: 'UNHEALTHY', error: error.message };
    }
  }
}
