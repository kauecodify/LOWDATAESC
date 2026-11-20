import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../services/logger.service';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

interface BacenConfig {
  api: {
    baseUrl: string;
    pixBaseUrl: string;
    timeout: number;
    apiKey: string;
    clientId: string;
    clientSecret: string;
  };
  splitPayment: {
    enabled: boolean;
    endpoint: string;
    maxRetries: number;
  };
  taxRates: {
    cbs: {
      endpoint: string;
      cacheTtl: number;
    };
    ibs: {
      endpoint: string;
      cacheTtl: number;
    };
  };
}

interface BacenTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface BacenSplitPaymentRequest {
  valor: number;
  descricao: string;
  devedor: {
    cpfCnpj: string;
    nome: string;
    conta: {
      agencia: string;
      numero: string;
      tipo: string;
      banco: string;
    };
  };
  credores: {
    cpfCnpj: string;
    nome: string;
    valor: number;
    conta: {
      agencia: string;
      numero: string;
      tipo: string;
      banco: string;
    };
  }[];
  chaves: string[];
}

interface BacenSplitPaymentResponse {
  id: string;
  status: string;
  valor: number;
  descricao: string;
  devedor: any;
  credores: any[];
  chaves: string[];
  criadoEm: string;
  atualizadoEm: string;
}

interface BacenTaxRateResponse {
  valor: number;
  vigencia: {
    inicio: string;
    fim: string;
  };
  origem: string;
  referencia: string;
}

@Injectable()
export class BacenAdapter {
  private readonly logger = new LoggerService();
  private axiosInstance: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private config: BacenConfig;

  constructor(
    private configService: ConfigService,
    private poolLogger: LoggerService,
  ) {
    this.config = this.configService.get('bacen');
    
    this.axiosInstance = axios.create({
      baseURL: this.config.api.baseUrl,
      timeout: this.config.api.timeout || 30000,
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
        this.logger.error('BACEN request interceptor error', error);
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
    if (this.config.api.clientId && this.config.api.clientSecret) {
      await this.authenticate();
    }
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post<BacenTokenResponse>(
        `${this.config.api.baseUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.config.api.clientId,
          client_secret: this.config.api.clientSecret,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: this.config.api.timeout,
        }
      );

      this.token = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));

      this.logger.log('BACEN authentication successful', {
        expiresIn: response.data.expires_in,
      });
    } catch (error) {
      this.logger.error('BACEN authentication failed', error);
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

      if (!this.config.splitPayment.enabled) {
        throw new Error('BACEN split payment is not enabled');
      }

      // Map transaction to BACEN format
      const request = this.mapToBacenFormat(transaction);

      const response = await this.axiosInstance.post<BacenSplitPaymentResponse>(
        this.config.splitPayment.endpoint,
        request
      );

      this.logger.log('BACEN split payment submitted', {
        transactionId: transaction.id,
        bacenTransactionId: response.data.id,
      });

      return {
        success: true,
        transactionId: response.data.id,
        splitTransactionId: response.data.id,
        status: response.data.status,
        response: response.data,
      };
    } catch (error) {
      this.logger.error('BACEN split payment submission failed', {
        transactionId: transaction.id,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  private mapToBacenFormat(transaction: any): BacenSplitPaymentRequest {
    // Map supplier, CBS, and IBS accounts to BACEN format
    const credores = [];

    // Supplier
    if (transaction.splitAmounts.supplier) {
      credores.push({
        cpfCnpj: transaction.splitAmounts.supplier.bankDetails?.documentNumber || 
                 transaction.splitAmounts.supplier.pixDetails?.documentNumber || '',
        nome: transaction.splitAmounts.supplier.bankDetails?.holderName || 
              transaction.splitAmounts.supplier.pixDetails?.holderName || '',
        valor: transaction.splitAmounts.supplier.amount,
        conta: {
          agencia: transaction.splitAmounts.supplier.bankDetails?.agency || '',
          numero: transaction.splitAmounts.supplier.bankDetails?.accountNumber || '',
          tipo: transaction.splitAmounts.supplier.bankDetails?.accountType || '',
          banco: transaction.splitAmounts.supplier.bankDetails?.bankCode || '',
        },
      });
    }

    // CBS
    if (transaction.splitAmounts.cbs) {
      credores.push({
        cpfCnpj: transaction.taxInfo.cbs.accountId,
        nome: 'Comite Gestor CBS',
        valor: transaction.taxInfo.cbs.amount,
        conta: {
          agencia: '',
          numero: '',
          tipo: 'CONTA_CORRENTE',
          banco: '001', // BACEN
        },
      });
    }

    // IBS
    if (transaction.splitAmounts.ibs) {
      credores.push({
        cpfCnpj: transaction.taxInfo.ibs.accountId,
        nome: 'Entidade Federativa IBS',
        valor: transaction.taxInfo.ibs.amount,
        conta: {
          agencia: '',
          numero: '',
          tipo: 'CONTA_CORRENTE',
          banco: '001', // BACEN
        },
      });
    }

    return {
      valor: transaction.originalAmount,
      descricao: `Split Payment - ${transaction.id}`,
      devedor: {
        cpfCnpj: transaction.supplierAccount.bankDetails?.documentNumber || 
                 transaction.supplierAccount.pixDetails?.documentNumber || '',
        nome: transaction.supplierAccount.bankDetails?.holderName || 
              transaction.supplierAccount.pixDetails?.holderName || '',
        conta: {
          agencia: transaction.supplierAccount.bankDetails?.agency || '',
          numero: transaction.supplierAccount.bankDetails?.accountNumber || '',
          tipo: transaction.supplierAccount.bankDetails?.accountType || '',
          banco: transaction.supplierAccount.bankDetails?.bankCode || '',
        },
      },
      credores,
      chaves: [],
    };
  }

  async getCBSRate(): Promise<number> {
    try {
      await this.ensureAuthenticated();

      const response = await this.axiosInstance.get<BacenTaxRateResponse>(
        this.config.taxRates.cbs.endpoint
      );

      this.logger.log('BACEN CBS rate retrieved', {
        rate: response.data.valor,
        validFrom: response.data.vigencia.inicio,
        validTo: response.data.vigencia.fim,
      });

      return response.data.valor;
    } catch (error) {
      this.logger.error('Failed to get CBS rate from BACEN', error);
      throw error;
    }
  }

  async getIBSRate(stateCode: string, municipalityCode?: string): Promise<number> {
    try {
      await this.ensureAuthenticated();

      let endpoint = this.config.taxRates.ibs.endpoint;
      
      // Add query parameters for state and municipality
      const params = new URLSearchParams();
      params.append('estado', stateCode);
      if (municipalityCode) {
        params.append('municipio', municipalityCode);
      }

      const response = await this.axiosInstance.get<BacenTaxRateResponse>(
        `${endpoint}?${params.toString()}`
      );

      this.logger.log('BACEN IBS rate retrieved', {
        stateCode,
        municipalityCode,
        rate: response.data.valor,
        validFrom: response.data.vigencia.inicio,
        validTo: response.data.vigencia.fim,
      });

      return response.data.valor;
    } catch (error) {
      this.logger.error('Failed to get IBS rate from BACEN', {
        stateCode,
        municipalityCode,
        error: error.message,
      });
      throw error;
    }
  }

  async getStatus(transactionId: string): Promise<{ status: string; error?: string; data?: any }> {
    try {
      await this.ensureAuthenticated();

      const response = await this.axiosInstance.get<BacenSplitPaymentResponse>(
        `${this.config.splitPayment.endpoint}/${transactionId}`
      );

      return {
        status: response.data.status,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('Failed to get BACEN transaction status', {
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

      // In production, this would call the BACEN refund endpoint
      // For now, simulate success
      this.logger.log('BACEN refund initiated', {
        transactionId,
        amount,
      });

      return {
        success: true,
        refundId: `refund-${transactionId}-${Date.now()}`,
      };
    } catch (error) {
      this.logger.error('Failed to initiate BACEN refund', {
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
      
      // Make a simple request to check if API is up
      await this.axiosInstance.get('/health');

      return { status: 'HEALTHY' };
    } catch (error) {
      this.logger.error('BACEN health check failed', error);
      return { status: 'UNHEALTHY', error: error.message };
    }
  }
}
