import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between, MoreThan, LessThan } from 'typeorm';
import { Calculation, CalculationResult, DistributionRule } from './entities/calculation.entity';
import { CalculationStatus, CalculationType, Currency } from './dto/create-calculation.dto';
import { LoggerService } from '../../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CalculationRepository {
  private readonly logger = new LoggerService('CalculationRepository');

  constructor(
    @InjectRepository(Calculation)
    private readonly calculationRepository: Repository<Calculation>,
    @InjectRepository(CalculationResult)
    private readonly calculationResultRepository: Repository<CalculationResult>,
    @InjectRepository(DistributionRule)
    private readonly distributionRuleRepository: Repository<DistributionRule>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  // ============================================================================
  // CALCULATION OPERATIONS
  // ============================================================================

  async create(calculationData: Partial<Calculation>): Promise<Calculation> {
    const calculation = this.calculationRepository.create(calculationData);
    
    // Calculate hash before saving
    const previousHash = await this.getLastCalculationHash();
    calculation.previousHash = previousHash;
    calculation.calculationHash = calculation.calculateHash(previousHash);

    const saved = await this.calculationRepository.save(calculation);
    
    this.logger.log('Created calculation', {
      id: saved.id,
      eventId: saved.eventId,
      type: saved.type,
      status: saved.status,
    });

    return saved;
  }

  async findById(id: string): Promise<Calculation | null> {
    return this.calculationRepository.findOne({
      where: { id, isDeleted: false },
    });
  }

  async findByEventId(eventId: string): Promise<Calculation | null> {
    return this.calculationRepository.findOne({
      where: { eventId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  async findByCalculationHash(hash: string): Promise<Calculation | null> {
    return this.calculationRepository.findOne({
      where: { calculationHash: hash, isDeleted: false },
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 100,
    status?: CalculationStatus,
    type?: CalculationType,
    startDate?: string,
    endDate?: string,
    eventId?: string,
    distributionRuleId?: string,
  ): Promise<{ data: Calculation[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const where: any = { isDeleted: false };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (eventId) {
      where.eventId = eventId;
    }

    if (distributionRuleId) {
      where.distributionRuleId = distributionRuleId;
    }

    if (startDate && endDate) {
      where.calculatedAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.calculatedAt = MoreThan(new Date(startDate));
    } else if (endDate) {
      where.calculatedAt = LessThan(new Date(endDate));
    }

    const [data, total] = await Promise.all([
      this.calculationRepository.find({
        where,
        order: { calculatedAt: 'DESC' },
        skip,
        take: limit,
      }),
      this.calculationRepository.count({ where }),
    ]);

    return {
      data,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, updateData: Partial<Calculation>): Promise<Calculation | null> {
    const calculation = await this.findById(id);
    
    if (!calculation) {
      this.logger.warn('Calculation not found for update', { id });
      return null;
    }

    // Update version for optimistic locking
    updateData.version = calculation.version + 1;

    const updated = await this.calculationRepository.save({
      ...calculation,
      ...updateData,
    });

    this.logger.log('Updated calculation', {
      id: updated.id,
      status: updated.status,
    });

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const calculation = await this.findById(id);
    
    if (!calculation) {
      this.logger.warn('Calculation not found for deletion', { id });
      return false;
    }

    calculation.softDelete();
    await this.calculationRepository.save(calculation);

    this.logger.log('Soft deleted calculation', { id });
    return true;
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await this.calculationRepository.delete(id);
    
    if (result.affected && result.affected > 0) {
      this.logger.log('Hard deleted calculation', { id });
      return true;
    }
    
    return false;
  }

  async getLastCalculationHash(): Promise<string | null> {
    const lastCalculation = await this.calculationRepository.findOne({
      where: { isDeleted: false },
      order: { calculatedAt: 'DESC', createdAt: 'DESC' },
    });

    return lastCalculation?.calculationHash || null;
  }

  async verifyHashChain(calculationId: string): Promise<boolean> {
    const calculation = await this.findById(calculationId);
    
    if (!calculation) {
      return false;
    }

    // Verify current hash
    const expectedHash = calculation.calculateHash(calculation.previousHash);
    if (expectedHash !== calculation.calculationHash) {
      this.logger.error('Hash chain verification failed - current hash mismatch', {
        calculationId,
        expectedHash,
        actualHash: calculation.calculationHash,
      });
      return false;
    }

    // Verify chain by checking previous calculations
    if (calculation.previousHash) {
      const previousCalculation = await this.findByCalculationHash(calculation.previousHash);
      
      if (!previousCalculation) {
        this.logger.error('Hash chain verification failed - previous calculation not found', {
          calculationId,
          previousHash: calculation.previousHash,
        });
        return false;
      }

      return this.verifyHashChain(previousCalculation.id);
    }

    return true;
  }

  async getHashChain(calculationId: string, depth: number = 10): Promise<Calculation[]> {
    const chain: Calculation[] = [];
    let current = await this.findById(calculationId);

    while (current && chain.length < depth) {
      chain.push(current);
      if (current.previousHash) {
        current = await this.findByCalculationHash(current.previousHash);
      } else {
        current = null;
      }
    }

    return chain;
  }

  // ============================================================================
  // CALCULATION RESULT OPERATIONS
  // ============================================================================

  async createResult(resultData: Partial<CalculationResult>): Promise<CalculationResult> {
    const result = this.calculationResultRepository.create(resultData);
    return this.calculationResultRepository.save(result);
  }

  async createResults(results: Partial<CalculationResult>[]): Promise<CalculationResult[]> {
    const resultEntities = this.calculationResultRepository.create(results);
    return this.calculationResultRepository.save(resultEntities);
  }

  async findResultsByCalculationId(calculationId: string): Promise<CalculationResult[]> {
    return this.calculationResultRepository.find({
      where: { calculationId },
      order: { createdAt: 'ASC' },
    });
  }

  async deleteResultsByCalculationId(calculationId: string): Promise<boolean> {
    const result = await this.calculationResultRepository.delete({ calculationId });
    return result.affected && result.affected > 0;
  }

  // ============================================================================
  // DISTRIBUTION RULE OPERATIONS
  // ============================================================================

  async createDistributionRule(ruleData: Partial<DistributionRule>): Promise<DistributionRule> {
    const rule = this.distributionRuleRepository.create(ruleData);
    return this.distributionRuleRepository.save(rule);
  }

  async findDistributionRuleById(id: string): Promise<DistributionRule | null> {
    return this.distributionRuleRepository.findOne({
      where: { id },
    });
  }

  async findDistributionRuleByName(name: string): Promise<DistributionRule | null> {
    return this.distributionRuleRepository.findOne({
      where: { name },
    });
  }

  async findAllDistributionRules(
    page: number = 1,
    limit: number = 100,
    isActive?: boolean,
  ): Promise<{ data: DistributionRule[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.distributionRuleRepository.find({
        where,
        order: { priority: 'ASC', name: 'ASC' },
        skip,
        take: limit,
      }),
      this.distributionRuleRepository.count({ where }),
    ]);

    return {
      data,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateDistributionRule(id: string, updateData: Partial<DistributionRule>): Promise<DistributionRule | null> {
    const rule = await this.findDistributionRuleById(id);
    
    if (!rule) {
      return null;
    }

    updateData.version = rule.version + 1;
    updateData.updatedAt = new Date();

    return this.distributionRuleRepository.save({
      ...rule,
      ...updateData,
    });
  }

  async deleteDistributionRule(id: string): Promise<boolean> {
    const result = await this.distributionRuleRepository.delete(id);
    return result.affected && result.affected > 0;
  }

  async getActiveDistributionRules(): Promise<DistributionRule[]> {
    return this.distributionRuleRepository.find({
      where: { isActive: true },
      order: { priority: 'ASC' },
    });
  }

  async getDistributionRuleByEventType(eventType: string): Promise<DistributionRule | null> {
    const rules = await this.getActiveDistributionRules();
    
    for (const rule of rules) {
      if (rule.conditions?.eventType === eventType) {
        return rule;
      }
    }

    // Return default rule (first active rule)
    return rules.length > 0 ? rules[0] : null;
  }

  // ============================================================================
  // STATISTICS AND METRICS
  // ============================================================================

  async getStats(): Promise<any> {
    const [
      total,
      pending,
      processing,
      completed,
      failed,
      byType,
      byCurrency,
      recentCalculations,
    ] = await Promise.all([
      this.calculationRepository.count({ where: { isDeleted: false } }),
      this.calculationRepository.count({ where: { status: CalculationStatus.PENDING, isDeleted: false } }),
      this.calculationRepository.count({ where: { status: CalculationStatus.PROCESSING, isDeleted: false } }),
      this.calculationRepository.count({ where: { status: CalculationStatus.COMPLETED, isDeleted: false } }),
      this.calculationRepository.count({ where: { status: CalculationStatus.FAILED, isDeleted: false } }),
      this.getStatsByType(),
      this.getStatsByCurrency(),
      this.getRecentCalculations(),
    ]);

    return {
      total,
      byStatus: {
        pending,
        processing,
        completed,
        failed,
        reprocessing: 0,
        cancelled: 0,
      },
      byType,
      byCurrency,
      recentCalculations,
      errorRate: total > 0 ? (failed / total) * 100 : 0,
      successRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  private async getStatsByType(): Promise<Record<string, number>> {
    const results = await this.calculationRepository
      .createQueryBuilder('calculation')
      .select('calculation.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('calculation.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('calculation.type')
      .getRawMany();

    const stats: Record<string, number> = {};
    results.forEach((r) => {
      stats[r.type] = parseInt(r.count);
    });

    return stats;
  }

  private async getStatsByCurrency(): Promise<Record<string, number>> {
    const results = await this.calculationRepository
      .createQueryBuilder('calculation')
      .select('calculation.currency', 'currency')
      .addSelect('COUNT(*)', 'count')
      .where('calculation.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('calculation.currency')
      .getRawMany();

    const stats: Record<string, number> = {};
    results.forEach((r) => {
      stats[r.currency] = parseInt(r.count);
    });

    return stats;
  }

  private async getRecentCalculations(limit: number = 10): Promise<Calculation[]> {
    return this.calculationRepository.find({
      where: { isDeleted: false },
      order: { calculatedAt: 'DESC' },
      take: limit,
    });
  }

  async getFailedCalculations(limit: number = 100): Promise<Calculation[]> {
    return this.calculationRepository.find({
      where: {
        status: CalculationStatus.FAILED,
        isDeleted: false,
      },
      order: { calculatedAt: 'DESC' },
      take: limit,
    });
  }

  async getPendingCalculations(limit: number = 100): Promise<Calculation[]> {
    return this.calculationRepository.find({
      where: {
        status: In([CalculationStatus.PENDING, CalculationStatus.REPROCESSING]),
        isDeleted: false,
      },
      order: { priority: 'DESC', calculatedAt: 'ASC' },
      take: limit,
    });
  }

  // ============================================================================
  // TRANSACTION OPERATIONS
  // ============================================================================

  async createWithTransaction(calculationData: Partial<Calculation>, results: Partial<CalculationResult>[]): Promise<Calculation> {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      // Create calculation
      const calculation = transactionalEntityManager.create(Calculation, calculationData);
      
      // Calculate hash
      const previousHash = await this.getLastCalculationHash();
      calculation.previousHash = previousHash;
      calculation.calculationHash = calculation.calculateHash(previousHash);

      const savedCalculation = await transactionalEntityManager.save(Calculation, calculation);

      // Create results
      const resultEntities = results.map((result) => ({
        ...result,
        calculationId: savedCalculation.id,
      }));
      
      await transactionalEntityManager.save(CalculationResult, resultEntities);

      // Update calculation with results
      savedCalculation.results = resultEntities as any;
      
      return savedCalculation;
    });
  }

  async completeCalculationWithTransaction(
    calculationId: string,
    results: Partial<CalculationResult>[],
    summary: {
      totalAmount: number;
      grossAmount: number;
      netAmount: number;
      totalDeductions: number;
    },
  ): Promise<Calculation> {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const calculation = await transactionalEntityManager.findOne(Calculation, {
        where: { id: calculationId, isDeleted: false },
      });

      if (!calculation) {
        throw new Error(`Calculation not found: ${calculationId}`);
      }

      // Create results
      const resultEntities = results.map((result) => ({
        ...result,
        calculationId: calculation.id,
      }));
      
      await transactionalEntityManager.save(CalculationResult, resultEntities);

      // Update calculation
      calculation.markAsCompleted(resultEntities as any);
      calculation.totalAmount = summary.totalAmount;
      calculation.grossAmount = summary.grossAmount;
      calculation.netAmount = summary.netAmount;
      calculation.totalDeductions = summary.totalDeductions;
      
      // Recalculate hash with results
      calculation.calculationHash = calculation.calculateHash(calculation.previousHash);

      const updated = await transactionalEntityManager.save(Calculation, calculation);

      this.logger.log('Completed calculation with transaction', {
        calculationId: updated.id,
        totalAmount: updated.totalAmount,
        resultCount: resultEntities.length,
      });

      return updated;
    });
  }

  // ============================================================================
  // CLEANUP OPERATIONS
  // ============================================================================

  async cleanupOldCalculations(days: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await this.calculationRepository.update(
      {
        isDeleted: false,
        calculatedAt: LessThan(cutoffDate),
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );

    this.logger.log('Cleaned up old calculations', {
      count: result.affected,
      days,
    });

    return result.affected || 0;
  }

  async cleanupOrphanedResults(): Promise<number> {
    // Find calculations that don't exist
    const query = `
      DELETE FROM calculation.calculation_results
      WHERE calculation_id NOT IN (
        SELECT id FROM calculation.calculations
      )
    `;

    const result = await this.dataSource.query(query);
    
    this.logger.log('Cleaned up orphaned calculation results', {
      count: result?.affectedRows || 0,
    });

    return result?.affectedRows || 0;
  }
}
