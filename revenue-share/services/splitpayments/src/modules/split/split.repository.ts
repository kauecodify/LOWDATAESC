import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';
import { SplitTransaction, SplitEscrowAccount, TaxRateCache, SplitAuditLog } from './entities/split-transaction.entity';
import { PaymentStatus, PaymentMethod, TransactionType, Currency } from './dto/create-split-transaction.dto';
import { QuerySplitTransactionDto } from './dto/create-split-transaction.dto';
import { LoggerService } from '../../common/logger/logger.service';

interface SplitTransactionFilters {
  consortiumId?: string;
  paymentId?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  transactionType?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  referenceId?: string;
}

interface SplitTransactionResult {
  transactions: SplitTransaction[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class SplitRepository {
  private readonly logger = new LoggerService();

  constructor(
    @InjectRepository(SplitTransaction)
    private splitTransactionRepository: Repository<SplitTransaction>,
    @InjectRepository(SplitEscrowAccount)
    private escrowAccountRepository: Repository<SplitEscrowAccount>,
    @InjectRepository(TaxRateCache)
    private taxRateRepository: Repository<TaxRateCache>,
    @InjectRepository(SplitAuditLog)
    private auditLogRepository: Repository<SplitAuditLog>,
    private dataSource: DataSource,
  ) {}

  // Split Transaction methods
  async createSplitTransaction(data: Partial<SplitTransaction>): Promise<SplitTransaction> {
    try {
      const transaction = this.splitTransactionRepository.create(data);
      return await this.splitTransactionRepository.save(transaction);
    } catch (error) {
      this.logger.error('Failed to create split transaction', {
        data: JSON.stringify(data),
        error: error.message,
      });
      throw error;
    }
  }

  async findById(id: string, consortiumId?: string): Promise<SplitTransaction | null> {
    try {
      const query = this.splitTransactionRepository
        .createQueryBuilder('st')
        .where('st.id = :id', { id });

      if (consortiumId) {
        query.andWhere('st.consortiumId = :consortiumId', { consortiumId });
      }

      return await query.getOne();
    } catch (error) {
      this.logger.error('Failed to find split transaction by ID', {
        id,
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  async findByPaymentId(paymentId: string, consortiumId?: string): Promise<SplitTransaction | null> {
    try {
      const query = this.splitTransactionRepository
        .createQueryBuilder('st')
        .where('st.paymentId = :paymentId', { paymentId });

      if (consortiumId) {
        query.andWhere('st.consortiumId = :consortiumId', { consortiumId });
      }

      return await query.getOne();
    } catch (error) {
      this.logger.error('Failed to find split transaction by payment ID', {
        paymentId,
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  async findBySplitHash(splitHash: string): Promise<SplitTransaction | null> {
    try {
      return await this.splitTransactionRepository.findOne({
        where: { splitHash },
      });
    } catch (error) {
      this.logger.error('Failed to find split transaction by hash', {
        splitHash,
        error: error.message,
      });
      throw error;
    }
  }

  async findByReferenceId(referenceId: string, consortiumId?: string): Promise<SplitTransaction | null> {
    try {
      const query = this.splitTransactionRepository
        .createQueryBuilder('st')
        .where('st.referenceId = :referenceId', { referenceId });

      if (consortiumId) {
        query.andWhere('st.consortiumId = :consortiumId', { consortiumId });
      }

      return await query.getOne();
    } catch (error) {
      this.logger.error('Failed to find split transaction by reference ID', {
        referenceId,
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  async findAll(filters: QuerySplitTransactionDto): Promise<SplitTransactionResult> {
    try {
      const page = filters.page || 1;
      const pageSize = filters.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const query = this.buildQuery(filters);

      // Get total count
      const total = await query.getCount();

      // Get paginated results
      query.offset(skip).limit(pageSize);

      // Apply sorting
      if (filters.sortBy) {
        const sortOrder = filters.sortOrder || 'DESC';
        const sortField = this.mapSortField(filters.sortBy);
        query.orderBy(`st.${sortField}`, sortOrder);
      } else {
        query.orderBy('st.createdAt', 'DESC');
      }

      const transactions = await query.getMany();

      return {
        transactions,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      this.logger.error('Failed to find all split transactions', {
        filters: JSON.stringify(filters),
        error: error.message,
      });
      throw error;
    }
  }

  private buildQuery(filters: QuerySplitTransactionDto): SelectQueryBuilder<SplitTransaction> {
    const query = this.splitTransactionRepository.createQueryBuilder('st');

    if (filters.consortiumId) {
      query.andWhere('st.consortiumId = :consortiumId', { consortiumId: filters.consortiumId });
    }

    if (filters.paymentId) {
      query.andWhere('st.paymentId = :paymentId', { paymentId: filters.paymentId });
    }

    if (filters.status) {
      query.andWhere('st.status = :status', { status: filters.status });
    }

    if (filters.method) {
      query.andWhere('st.method = :method', { method: filters.method });
    }

    if (filters.startDate) {
      query.andWhere('st.createdAt >= :startDate', { startDate: new Date(filters.startDate) });
    }

    if (filters.endDate) {
      query.andWhere('st.createdAt <= :endDate', { endDate: new Date(filters.endDate) });
    }

    return query;
  }

  private mapSortField(field: string): string {
    const fieldMap: Record<string, string> = {
      'createdAt': 'createdAt',
      'updatedAt': 'updatedAt',
      'amount': 'originalAmount',
      'status': 'status',
      'method': 'method',
    };
    return fieldMap[field] || 'createdAt';
  }

  async update(id: string, data: Partial<SplitTransaction>, consortiumId?: string): Promise<SplitTransaction | null> {
    try {
      const query = this.splitTransactionRepository
        .createQueryBuilder()
        .update(SplitTransaction)
        .set(data)
        .where('id = :id', { id });

      if (consortiumId) {
        query.andWhere('consortiumId = :consortiumId', { consortiumId });
      }

      await query.execute();

      return this.findById(id, consortiumId);
    } catch (error) {
      this.logger.error('Failed to update split transaction', {
        id,
        consortiumId,
        data: JSON.stringify(data),
        error: error.message,
      });
      throw error;
    }
  }

  async updateStatus(id: string, status: PaymentStatus, consortiumId?: string, errorInfo?: any): Promise<SplitTransaction | null> {
    try {
      const updateData: Partial<SplitTransaction> = { status };

      if (errorInfo) {
        updateData.errorInfo = errorInfo;
      }

      return this.update(id, updateData, consortiumId);
    } catch (error) {
      this.logger.error('Failed to update split transaction status', {
        id,
        consortiumId,
        status,
        error: error.message,
      });
      throw error;
    }
  }

  async delete(id: string, consortiumId?: string): Promise<boolean> {
    try {
      const query = this.splitTransactionRepository
        .createQueryBuilder()
        .delete()
        .from(SplitTransaction)
        .where('id = :id', { id });

      if (consortiumId) {
        query.andWhere('consortiumId = :consortiumId', { consortiumId });
      }

      const result = await query.execute();
      return result.affected && result.affected > 0;
    } catch (error) {
      this.logger.error('Failed to delete split transaction', {
        id,
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  // Escrow Account methods
  async createEscrowAccount(data: Partial<SplitEscrowAccount>): Promise<SplitEscrowAccount> {
    try {
      const account = this.escrowAccountRepository.create(data);
      return await this.escrowAccountRepository.save(account);
    } catch (error) {
      this.logger.error('Failed to create escrow account', {
        data: JSON.stringify(data),
        error: error.message,
      });
      throw error;
    }
  }

  async findEscrowAccountById(id: string, consortiumId?: string): Promise<SplitEscrowAccount | null> {
    try {
      const query = this.escrowAccountRepository
        .createQueryBuilder('sea')
        .where('sea.id = :id', { id });

      if (consortiumId) {
        query.andWhere('sea.consortiumId = :consortiumId', { consortiumId });
      }

      return await query.getOne();
    } catch (error) {
      this.logger.error('Failed to find escrow account by ID', {
        id,
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  async findEscrowAccountByAccountNumber(accountNumber: string, consortiumId?: string): Promise<SplitEscrowAccount | null> {
    try {
      const query = this.escrowAccountRepository
        .createQueryBuilder('sea')
        .where('sea.accountNumber = :accountNumber', { accountNumber });

      if (consortiumId) {
        query.andWhere('sea.consortiumId = :consortiumId', { consortiumId });
      }

      return await query.getOne();
    } catch (error) {
      this.logger.error('Failed to find escrow account by account number', {
        accountNumber,
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  async findEscrowAccountsByConsortium(consortiumId: string): Promise<SplitEscrowAccount[]> {
    try {
      return await this.escrowAccountRepository.find({
        where: { consortiumId },
      });
    } catch (error) {
      this.logger.error('Failed to find escrow accounts by consortium', {
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  async updateEscrowAccount(id: string, data: Partial<SplitEscrowAccount>, consortiumId?: string): Promise<SplitEscrowAccount | null> {
    try {
      const query = this.escrowAccountRepository
        .createQueryBuilder()
        .update(SplitEscrowAccount)
        .set(data)
        .where('id = :id', { id });

      if (consortiumId) {
        query.andWhere('consortiumId = :consortiumId', { consortiumId });
      }

      await query.execute();

      return this.findEscrowAccountById(id, consortiumId);
    } catch (error) {
      this.logger.error('Failed to update escrow account', {
        id,
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  async updateEscrowBalance(id: string, amount: number, consortiumId?: string): Promise<SplitEscrowAccount | null> {
    try {
      const account = await this.findEscrowAccountById(id, consortiumId);
      if (!account) {
        throw new Error('Escrow account not found');
      }

      const newBalance = account.balance + amount;
      return this.updateEscrowAccount(id, { balance: newBalance }, consortiumId);
    } catch (error) {
      this.logger.error('Failed to update escrow balance', {
        id,
        consortiumId,
        amount,
        error: error.message,
      });
      throw error;
    }
  }

  // Tax Rate methods
  async createTaxRate(data: Partial<TaxRateCache>): Promise<TaxRateCache> {
    try {
      const taxRate = this.taxRateRepository.create(data);
      return await this.taxRateRepository.save(taxRate);
    } catch (error) {
      this.logger.error('Failed to create tax rate', {
        data: JSON.stringify(data),
        error: error.message,
      });
      throw error;
    }
  }

  async findTaxRateByType(taxType: string, stateCode?: string, municipalityCode?: string): Promise<TaxRateCache | null> {
    try {
      const query = this.taxRateRepository
        .createQueryBuilder('trc')
        .where('trc.taxType = :taxType', { taxType })
        .andWhere('trc.validFrom <= NOW()')
        .andWhere('trc.validTo >= NOW()')
        .orderBy('trc.validFrom', 'DESC')
        .limit(1);

      if (stateCode) {
        query.andWhere('trc.stateCode = :stateCode', { stateCode });
      }

      if (municipalityCode) {
        query.andWhere('trc.municipalityCode = :municipalityCode', { municipalityCode });
      }

      return await query.getOne();
    } catch (error) {
      this.logger.error('Failed to find tax rate', {
        taxType,
        stateCode,
        municipalityCode,
        error: error.message,
      });
      throw error;
    }
  }

  async findLatestCBSRate(): Promise<TaxRateCache | null> {
    try {
      return await this.taxRateRepository.findOne({
        where: {
          taxType: 'CBS',
          validFrom: { $lte: new Date() },
          validTo: { $gte: new Date() },
        },
        order: { validFrom: 'DESC' },
      });
    } catch (error) {
      this.logger.error('Failed to find latest CBS rate', {
        error: error.message,
      });
      throw error;
    }
  }

  async findLatestIBSRate(stateCode: string, municipalityCode?: string): Promise<TaxRateCache | null> {
    try {
      const query = this.taxRateRepository
        .createQueryBuilder('trc')
        .where('trc.taxType = :taxType', { taxType: 'IBS' })
        .andWhere('trc.stateCode = :stateCode', { stateCode })
        .andWhere('trc.validFrom <= NOW()')
        .andWhere('trc.validTo >= NOW()')
        .orderBy('trc.validFrom', 'DESC')
        .limit(1);

      if (municipalityCode) {
        query.andWhere('trc.municipalityCode = :municipalityCode', { municipalityCode });
      }

      return await query.getOne();
    } catch (error) {
      this.logger.error('Failed to find latest IBS rate', {
        stateCode,
        municipalityCode,
        error: error.message,
      });
      throw error;
    }
  }

  async updateTaxRate(id: string, data: Partial<TaxRateCache>): Promise<TaxRateCache | null> {
    try {
      await this.taxRateRepository.update(id, data);
      return this.taxRateRepository.findOne({ where: { id } });
    } catch (error) {
      this.logger.error('Failed to update tax rate', {
        id,
        error: error.message,
      });
      throw error;
    }
  }

  // Audit Log methods
  async createAuditLog(data: Partial<SplitAuditLog>): Promise<SplitAuditLog> {
    try {
      const auditLog = this.auditLogRepository.create(data);
      return await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error('Failed to create audit log', {
        data: JSON.stringify(data),
        error: error.message,
      });
      throw error;
    }
  }

  async findAuditLogsByTransaction(transactionId: string, consortiumId?: string): Promise<SplitAuditLog[]> {
    try {
      const query = this.auditLogRepository
        .createQueryBuilder('sal')
        .where('sal.transactionId = :transactionId', { transactionId });

      if (consortiumId) {
        query.andWhere('sal.consortiumId = :consortiumId', { consortiumId });
      }

      query.orderBy('sal.createdAt', 'DESC');

      return await query.getMany();
    } catch (error) {
      this.logger.error('Failed to find audit logs by transaction', {
        transactionId,
        consortiumId,
        error: error.message,
      });
      throw error;
    }
  }

  async findAuditLogsByConsortium(consortiumId: string, startDate?: Date, endDate?: Date): Promise<SplitAuditLog[]> {
    try {
      const query = this.auditLogRepository
        .createQueryBuilder('sal')
        .where('sal.consortiumId = :consortiumId', { consortiumId });

      if (startDate) {
        query.andWhere('sal.createdAt >= :startDate', { startDate });
      }

      if (endDate) {
        query.andWhere('sal.createdAt <= :endDate', { endDate });
      }

      query.orderBy('sal.createdAt', 'DESC');

      return await query.getMany();
    } catch (error) {
      this.logger.error('Failed to find audit logs by consortium', {
        consortiumId,
        startDate,
        endDate,
        error: error.message,
      });
      throw error;
    }
  }

  // Transaction methods with explicit transaction support
  async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(callback);
  }
}
