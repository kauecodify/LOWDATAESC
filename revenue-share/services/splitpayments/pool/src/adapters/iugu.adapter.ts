import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../services/logger.service';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

interface IuguConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  accountId: string;
  splitEnabled: boolean;
  splitEndpoint: string;
  webhookToken: string;
  timeout: number;
}

interface IuguSplitPaymentRequest {
  token: string;
  email: string;
  amount: number;
  description: string;
  split_rules: {
    recipient_id: string;
    amount: number;
    percentage?: number;
  }[];
  customer_id?: string;
  customer_name?: string;
  customer_cpf_cnpj?: string;
  customer_phone?: string;
  customer_email?: string;
  payment_method: 'credit_card' | 'boleto' | 'pix';
  months?: number;
  credit_card_token?: string;
  pix_key?: string;
}

interface IuguSplitPaymentResponse {
  id: string;
  status: string;
  amount: number;
  description: string;
  customer_id: string;
  customer_name: string;
  payment_method: string;
  split_rules: any[];
  created_at: string;
  updated_at: string;
}

@Injectable()
export class IuguAdapter {
  private readonly logger = new LoggerService();
  private axiosInstance: AxiosInstance;
  private config: IuguConfig;

  constructor(
    private configService: ConfigService,
    private poolLogger: LoggerService,
  ) {
    this.config = this.configService.get('paymentGateways.iugu');
    
    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${this.config.apiKey}:`).toString('base64')}`,
      },
    });
  }

  async submitSplitPayment(
    transaction: any
  ): Promise<{ success: boolean; transactionId?: string; splitTransactionId?: string; status?: string; response?: any; error?: string }> {
    try {
      if (!this.config.enabled || !this.config.splitEnabled) {
        throw new Error('Iugu split payment is not enabled');
      }

      // Map transaction to Iugu format
      const request = this.mapToIuguFormat(transaction);

      const response = await this.axiosInstance.post<IuguSplitPaymentResponse>(
        this.config.splitEndpoint,
        request
      );

      this.logger.log('Iugu split payment submitted', {
        transactionId: transaction.id,
        iuguTransactionId: response.data.id,
      });

      return {
        success: true,
        transactionId: response.data.id,
        splitTransactionId: response.data.id,
        status: response.data.status,
        response: response.data,
      };
    } catch (error) {
      this.logger.error('Iugu split payment submission failed', {
        transactionId: transaction.id,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  private mapToIuguFormat(transaction: any): IuguSplitPaymentRequest {
    // Create split rules
    const splitRules = [];

    // Supplier (main recipient)
    splitRules.push({
      recipient_id: transaction.supplierAccount.externalId,
      amount: transaction.splitAmounts.supplier.amount,
    });

    // CBS
    splitRules.push({
      recipient_id: transaction.taxInfo.cbs.accountId,
      amount: transaction.taxInfo.cbs.amount,
    });

    // IBS
    splitRules.push({
      recipient_id: transaction.taxInfo.ibs.accountId,
      amount: transaction.taxInfo.ibs.amount,
    });

    // Determine payment method
    let paymentMethod: 'credit_card' | 'boleto' | 'pix' = 'pix';
    switch (transaction.method) {
      case 'PIX':
        paymentMethod = 'pix';
        break;
      case 'BOLETO':
        paymentMethod = 'boleto';
        break;
      case 'CREDIT_CARD':
      case 'DEBIT_CARD':
        paymentMethod = 'credit_card';
        break;
      default:
        paymentMethod = 'pix';
    }

    return {
      token: this.config.apiKey,
      email: transaction.supplierAccount.bankDetails?.holderName?.toLowerCase().replace(/\s+/g, '') + '@example.com',
      amount: transaction.originalAmount,
      description: `Split Payment - ${transaction.id}`,
      split_rules: splitRules,
      customer_name: transaction.supplierAccount.bankDetails?.holderName || 
                     transaction.supplierAccount.pixDetails?.holderName || '',
      customer_cpf_cnpj: transaction.supplierAccount.bankDetails?.documentNumber || 
                          transaction.supplierAccount.pixDetails?.documentNumber || '',
      payment_method: paymentMethod,
    };
  }

  async getStatus(transactionId: string): Promise<{ status: string; error?: string; data?: any }> {
    try {
      const response = await this.axiosInstance.get<IuguSplitPaymentResponse>(
        `/payments/${transactionId}`
      );

      return {
        status: response.data.status,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('Failed to get Iugu transaction status', {
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
          amount,
        }
      );

      this.logger.log('Iugu refund initiated', {
        transactionId,
        amount,
        refundId: response.data.id,
      });

      return {
        success: true,
        refundId: response.data.id,
      };
    } catch (error) {
      this.logger.error('Failed to initiate Iugu refund', {
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
      this.logger.error('Iugu health check failed', error);
      return { status: 'UNHEALTHY', error: error.message };
    }
  }
}
