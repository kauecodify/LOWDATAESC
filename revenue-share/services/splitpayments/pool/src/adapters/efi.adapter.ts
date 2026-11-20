import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../services/logger.service';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

interface EfiConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  splitEnabled: boolean;
  splitEndpoint: string;
  webhookToken: string;
  timeout: number;
}

interface EfiTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface EfiSplitPaymentRequest {
  valor: number;
  descricao: string;
  pagador: {
    cpfCnpj: string;
    nome: string;
    email: string;
    telefone: string;
  };
  recebedores: {
    cpfCnpj: string;
    nome: string;
    valor: number;
    chavePix?: string;
  }[];
  tipoPagamento: 'PIX' | 'BOLETO' | 'CREDITO' | 'DEBITO';
  dataVencimento?: string;
}

interface EfiSplitPaymentResponse {
  id: string;
  status: string;
  valor: number;
  descricao: string;
  pagador: any;
  recebedores: any[];
  tipoPagamento: string;
  dataCriacao: string;
  dataAtualizacao: string;
  dataVencimento?: string;
  txid?: string;
}

@Injectable()
export class EfiAdapter {
  private readonly logger = new LoggerService();
  private axiosInstance: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private config: EfiConfig;

  constructor(
    private configService: ConfigService,
    private poolLogger: LoggerService,
  ) {
    this.config = this.configService.get('paymentGateways.efi');
    
    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => {
        this.logger.error('EFI request interceptor error', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, refresh
          await this.authenticate();
          // Retry the request
          error.config.headers.Authorization = `Bearer ${this.token}`;
          return this.axiosInstance.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  async onModuleInit() {
    if (this.config.clientId && this.config.clientSecret) {
      await this.authenticate();
    }
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post<EfiTokenResponse>(
        `${this.config.apiUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: this.config.timeout,
        }
      );

      this.token = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));

      this.logger.log('EFI authentication successful', {
        expiresIn: response.data.expires_in,
      });
    } catch (error) {
      this.logger.error('EFI authentication failed', error);
      throw error;
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.token || !this.tokenExpiry || this.tokenExpiry < new Date()) {
      await this.authenticate();
    }
  }

  async submitSplitPayment(
    transaction: any
  ): Promise<{ success: boolean; transactionId?: string; splitTransactionId?: string; status?: string; response?: any; error?: string }> {
    try {
      await this.ensureAuthenticated();

      if (!this.config.enabled || !this.config.splitEnabled) {
        throw new Error('EFI split payment is not enabled');
      }

      // Map transaction to EFI format
      const request = this.mapToEfiFormat(transaction);

      const response = await this.axiosInstance.post<EfiSplitPaymentResponse>(
        this.config.splitEndpoint,
        request
      );

      this.logger.log('EFI split payment submitted', {
        transactionId: transaction.id,
        efiTransactionId: response.data.id,
      });

      return {
        success: true,
        transactionId: response.data.id,
        splitTransactionId: response.data.id,
        status: response.data.status,
        response: response.data,
      };
    } catch (error) {
      this.logger.error('EFI split payment submission failed', {
        transactionId: transaction.id,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  private mapToEfiFormat(transaction: any): EfiSplitPaymentRequest {
    // Create receivers
    const recebedores = [];

    // Supplier
    recebedores.push({
      cpfCnpj: transaction.supplierAccount.bankDetails?.documentNumber || 
               transaction.supplierAccount.pixDetails?.documentNumber || '',
      nome: transaction.supplierAccount.bankDetails?.holderName || 
            transaction.supplierAccount.pixDetails?.holderName || '',
      valor: transaction.splitAmounts.supplier.amount,
      chavePix: transaction.supplierAccount.pixDetails?.keyValue,
    });

    // CBS
    recebedores.push({
      cpfCnpj: transaction.taxInfo.cbs.accountId,
      nome: 'Comite Gestor CBS',
      valor: transaction.taxInfo.cbs.amount,
    });

    // IBS
    recebedores.push({
      cpfCnpj: transaction.taxInfo.ibs.accountId,
      nome: 'Entidade Federativa IBS',
      valor: transaction.taxInfo.ibs.amount,
    });

    // Determine payment type
    let tipoPagamento: 'PIX' | 'BOLETO' | 'CREDITO' | 'DEBITO' = 'PIX';
    switch (transaction.method) {
      case 'PIX':
        tipoPagamento = 'PIX';
        break;
      case 'BOLETO':
        tipoPagamento = 'BOLETO';
        break;
      case 'CREDIT_CARD':
        tipoPagamento = 'CREDITO';
        break;
      case 'DEBIT_CARD':
        tipoPagamento = 'DEBITO';
        break;
      default:
        tipoPagamento = 'PIX';
    }

    return {
      valor: transaction.originalAmount,
      descricao: `Split Payment - ${transaction.id}`,
      pagador: {
        cpfCnpj: transaction.supplierAccount.bankDetails?.documentNumber || 
                 transaction.supplierAccount.pixDetails?.documentNumber || '',
        nome: transaction.supplierAccount.bankDetails?.holderName || 
              transaction.supplierAccount.pixDetails?.holderName || '',
        email: '',
        telefone: '',
      },
      recebedores,
      tipoPagamento,
      dataVencimento: tipoPagamento === 'BOLETO' ? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
    };
  }

  async getStatus(transactionId: string): Promise<{ status: string; error?: string; data?: any }> {
    try {
      await this.ensureAuthenticated();

      const response = await this.axiosInstance.get<EfiSplitPaymentResponse>(
        `/pagamentos/${transactionId}`
      );

      return {
        status: response.data.status,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('Failed to get EFI transaction status', {
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
      await this.ensureAuthenticated();

      const response = await this.axiosInstance.post<{ id: string }>(
        `/pagamentos/${transactionId}/estornar`,
        {
          valor: amount,
        }
      );

      this.logger.log('EFI refund initiated', {
        transactionId,
        amount,
        refundId: response.data.id,
      });

      return {
        success: true,
        refundId: response.data.id,
      };
    } catch (error) {
      this.logger.error('Failed to initiate EFI refund', {
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
      await this.ensureAuthenticated();
      await this.axiosInstance.get('/health');
      return { status: 'HEALTHY' };
    } catch (error) {
      this.logger.error('EFI health check failed', error);
      return { status: 'UNHEALTHY', error: error.message };
    }
  }
}
