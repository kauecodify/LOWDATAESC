import { Injectable, OnModuleInit, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalculationRepository } from '../calculation.repository';
import { 
  CreateCalculationDto, 
  CalculationResponseDto, 
  CalculationType, 
  CalculationStatus,
  Currency,
  RoundingMethod,
  DistributionRuleDto,
  CalculationInputDto,
  CalculationResultDto,
} from '../dto/create-calculation.dto';
import { KafkaService, KafkaMessage } from '../../../common/kafka/kafka.service';
import { IdempotencyService } from '../../../common/idempotency/idempotency.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CalculationService implements OnModuleInit {
  private readonly logger = new LoggerService('CalculationService');
  private readonly kafkaTopic: string;
  private readonly serviceName: string;
  private readonly calculationConfig: any;

  constructor(
    private readonly calculationRepository: CalculationRepository,
    private readonly kafkaService: KafkaService,
    private readonly idempotencyService: IdempotencyService,
    private readonly configService: ConfigService,
  ) {
    const kafkaConfig = this.configService.get('kafka');
    const serviceConfig = this.configService.get('service');
    const calculationConfig = this.configService.get('calculation');
    
    this.kafkaTopic = kafkaConfig.topic?.calculationResults || 'calculation-results';
    this.serviceName = serviceConfig.name || 'calculation-service';
    this.calculationConfig = calculationConfig;
  }

  async onModuleInit() {
    // Start Kafka consumer for processing calculation requests
    this.startKafkaConsumer().catch((error) => {
      this.logger.error('Failed to start Kafka consumer', error);
    });
  }

  // ============================================================================
  // MAIN CALCULATION METHODS
  // ============================================================================

  async calculateRevenueShare(
    eventId: string,
    distributionRuleId: string,
    input: CalculationInputDto,
    options: {
      idempotencyKey?: string;
      correlationId?: string;
      source?: string;
      priority?: number;
    } = {},
  ): Promise<CalculationResponseDto> {
    const idempotencyKey = options.idempotencyKey || this.generateIdempotencyKey();
    const operation = `calculate_revenue_share_${eventId}`;

    // Check for idempotency
    const { exists, response: cachedResponse } = await this.idempotencyService.checkKey(
      idempotencyKey,
      operation,
    );

    if (exists) {
      this.logger.log('Idempotency: Returning cached calculation response', {
        idempotencyKey,
        operation,
      });
      return cachedResponse;
    }

    // Get distribution rule
    const distributionRule = await this.calculationRepository.findDistributionRuleById(distributionRuleId);
    
    if (!distributionRule) {
      throw new ConflictException(`Distribution rule not found: ${distributionRuleId}`);
    }

    if (!distributionRule.isActive) {
      throw new ConflictException(`Distribution rule is not active: ${distributionRuleId}`);
    }

    // Get previous hash for chain
    const previousHash = await this.calculationRepository.getLastCalculationHash();

    // Create calculation record
    const calculation = await this.calculationRepository.create({
      id: uuidv4(),
      eventId,
      distributionRuleId,
      type: CalculationType.REVENUE_SHARE,
      status: CalculationStatus.PROCESSING,
      input: {
        grossAmount: input.grossAmount,
        currency: input.currency,
        netAmount: input.netAmount,
        deductions: input.deductions,
        conversionRate: input.conversionRate,
      },
      grossAmount: input.grossAmount,
      netAmount: input.netAmount || input.grossAmount,
      totalDeductions: input.deductions?.reduce((sum, d) => sum + d.amount, 0) || 0,
      totalAmount: 0, // Will be calculated
      currency: input.currency,
      roundingMethod: input.roundingMethod || RoundingMethod.BANKER,
      previousHash,
      correlationId: options.correlationId,
      source: options.source,
      priority: options.priority || 0,
      metadata: {
        distributionRule: distributionRule.name,
        participants: distributionRule.participants.length,
      },
    });

    try {
      // Perform the calculation
      const results = await this.performCalculation(
        calculation,
        distributionRule,
        input,
      );

      // Update calculation with results
      const updatedCalculation = await this.calculationRepository.completeCalculationWithTransaction(
        calculation.id,
        results.map((r) => ({
          ...r,
          calculationId: calculation.id,
        })),
        {
          totalAmount: results.reduce((sum, r) => sum + r.amount, 0),
          grossAmount: input.grossAmount,
          netAmount: input.netAmount || input.grossAmount,
          totalDeductions: input.deductions?.reduce((sum, d) => sum + d.amount, 0) || 0,
        },
      );

      // Store response for idempotency
      await this.idempotencyService.setKey(idempotencyKey, operation, this.toResponseDto(updatedCalculation));

      // Publish to Kafka
      await this.publishToKafka(updatedCalculation);

      this.logger.log('Calculation completed successfully', {
        calculationId: updatedCalculation.id,
        eventId,
        totalAmount: updatedCalculation.totalAmount,
        resultCount: results.length,
      });

      return this.toResponseDto(updatedCalculation);
    } catch (error) {
      // Update calculation with error
      await this.calculationRepository.update(calculation.id, {
        status: CalculationStatus.FAILED,
        errorMessage: error.message,
        retryCount: calculation.retryCount + 1,
      });

      this.logger.error('Calculation failed', {
        calculationId: calculation.id,
        eventId,
        error: error.message,
      });

      throw error;
    }
  }

  async performCalculation(
    calculation: any,
    distributionRule: any,
    input: CalculationInputDto,
  ): Promise<CalculationResultDto[]> {
    const results: CalculationResultDto[] = [];
    const grossAmount = input.grossAmount;
    const netAmount = input.netAmount || grossAmount;
    const currency = input.currency;
    const roundingMethod = calculation.roundingMethod || RoundingMethod.BANKER;

    // Get participants from distribution rule
    const participants = distributionRule.participants || [];

    // Calculate total percentage (excluding fixed amounts)
    const percentageParticipants = participants.filter((p: any) => p.percentage > 0);
    const totalPercentage = percentageParticipants.reduce((sum: number, p: any) => sum + p.percentage, 0);

    // Calculate net amount after deductions
    const totalDeductions = input.deductions?.reduce((sum, d) => sum + d.amount, 0) || 0;
    const amountToDistribute = netAmount - totalDeductions;

    // Calculate distribution for each participant
    for (const participant of participants) {
      let amount = 0;

      if (participant.fixedAmount) {
        // Fixed amount distribution
        amount = participant.fixedAmount;
      } else if (participant.percentage > 0) {
        // Percentage-based distribution
        const percentage = participant.percentage / 100;
        amount = amountToDistribute * percentage;
      }

      // Apply floor if specified
      if (participant.floor && amount < participant.floor) {
        amount = participant.floor;
      }

      // Apply ceiling if specified
      if (participant.ceiling && amount > participant.ceiling) {
        amount = participant.ceiling;
      }

      // Round the amount
      amount = this.roundAmount(amount, roundingMethod);

      results.push({
        participantId: participant.id,
        participantName: participant.name,
        participantType: participant.type,
        amount,
        currency,
        percentage: participant.percentage || 0,
        fixedAmount: participant.fixedAmount,
      });
    }

    // Verify that total distribution equals amount to distribute
    const totalDistributed = results.reduce((sum, r) => sum + r.amount, 0);
    const difference = amountToDistribute - totalDistributed;

    // Adjust the first participant to account for rounding differences
    if (difference !== 0 && results.length > 0) {
      results[0].amount = this.roundAmount(results[0].amount + difference, roundingMethod);
    }

    return results;
  }

  // ============================================================================
  // CALCULATION HELPER METHODS
  // ============================================================================

  private roundAmount(amount: number, method: RoundingMethod): number {
    const precision = this.calculationConfig.displayPrecision || 2;
    const factor = Math.pow(10, precision);

    switch (method) {
      case RoundingMethod.BANKER:
        // Banker's rounding (round half to even)
        const rounded = Math.round(amount * factor);
        return rounded / factor;

      case RoundingMethod.UP:
        // Round up (ceiling)
        return Math.ceil(amount * factor) / factor;

      case RoundingMethod.DOWN:
        // Round down (floor)
        return Math.floor(amount * factor) / factor;

      case RoundingMethod.CEIL:
        // Ceiling
        return Math.ceil(amount);

      case RoundingMethod.FLOOR:
        // Floor
        return Math.floor(amount);

      case RoundingMethod.HALF_UP:
        // Round half up
        return Math.round(amount * factor) / factor;

      case RoundingMethod.HALF_DOWN:
        // Round half down
        const floored = Math.floor(amount * factor);
        const diff = amount * factor - floored;
        return (diff >= 0.5 ? floored + 1 : floored) / factor;

      default:
        // Default to banker's rounding
        return Math.round(amount * factor) / factor;
    }
  }

  private convertCurrency(amount: number, fromCurrency: Currency, toCurrency: Currency): number {
    // In a real implementation, this would use exchange rates
    // For now, return the same amount (no conversion)
    return amount;
  }

  private applyDeductions(grossAmount: number, deductions: any[]): { netAmount: number; totalDeductions: number } {
    const totalDeductions = deductions?.reduce((sum, d) => sum + d.amount, 0) || 0;
    const netAmount = grossAmount - totalDeductions;
    
    return { netAmount, totalDeductions };
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  async createCalculation(createCalculationDto: CreateCalculationDto): Promise<CalculationResponseDto> {
    const idempotencyKey = createCalculationDto.idempotencyKey || this.generateIdempotencyKey();
    const operation = 'create_calculation';

    // Check for idempotency
    const { exists, response: cachedResponse } = await this.idempotencyService.checkKey(
      idempotencyKey,
      operation,
    );

    if (exists) {
      return cachedResponse;
    }

    // Get distribution rule
    const distributionRule = await this.calculationRepository.findDistributionRuleById(
      createCalculationDto.distributionRuleId,
    );

    if (!distributionRule) {
      throw new ConflictException(`Distribution rule not found: ${createCalculationDto.distributionRuleId}`);
    }

    // Get previous hash
    const previousHash = await this.calculationRepository.getLastCalculationHash();

    // Create calculation
    const calculation = await this.calculationRepository.create({
      id: createCalculationDto.id || uuidv4(),
      eventId: createCalculationDto.eventId,
      distributionRuleId: createCalculationDto.distributionRuleId,
      type: createCalculationDto.type,
      status: CalculationStatus.PENDING,
      input: createCalculationDto.input,
      grossAmount: createCalculationDto.input.grossAmount,
      netAmount: createCalculationDto.input.netAmount || createCalculationDto.input.grossAmount,
      totalDeductions: createCalculationDto.input.deductions?.reduce((sum, d) => sum + d.amount, 0) || 0,
      totalAmount: 0,
      currency: createCalculationDto.input.currency,
      roundingMethod: createCalculationDto.roundingMethod,
      previousHash,
      correlationId: createCalculationDto.metadata?.correlationId,
      source: createCalculationDto.metadata?.source,
      priority: createCalculationDto.metadata?.priority || 0,
      metadata: createCalculationDto.metadata,
    });

    // Store response for idempotency
    await this.idempotencyService.setKey(idempotencyKey, operation, this.toResponseDto(calculation));

    return this.toResponseDto(calculation);
  }

  async getCalculation(id: string): Promise<CalculationResponseDto> {
    const calculation = await this.calculationRepository.findById(id);
    
    if (!calculation) {
      throw new ConflictException(`Calculation with ID ${id} not found`);
    }

    return this.toResponseDto(calculation);
  }

  async listCalculations(
    page: number = 1,
    limit: number = 100,
    status?: CalculationStatus,
    type?: CalculationType,
    startDate?: string,
    endDate?: string,
    eventId?: string,
  ): Promise<{ data: CalculationResponseDto[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const result = await this.calculationRepository.findAll(
      page,
      limit,
      status,
      type,
      startDate,
      endDate,
      eventId,
    );

    return {
      data: result.data.map((c) => this.toResponseDto(c)),
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async updateCalculation(id: string, updateData: Partial<any>): Promise<CalculationResponseDto> {
    const calculation = await this.calculationRepository.update(id, updateData);
    
    if (!calculation) {
      throw new ConflictException(`Calculation with ID ${id} not found`);
    }

    return this.toResponseDto(calculation);
  }

  async deleteCalculation(id: string): Promise<void> {
    const result = await this.calculationRepository.delete(id);
    
    if (!result) {
      throw new ConflictException(`Calculation with ID ${id} not found`);
    }
  }

  // ============================================================================
  // RETRY AND REPROCESSING
  // ============================================================================

  async retryCalculation(id: string): Promise<CalculationResponseDto> {
    const calculation = await this.calculationRepository.findById(id);
    
    if (!calculation) {
      throw new ConflictException(`Calculation with ID ${id} not found`);
    }

    if (calculation.status !== CalculationStatus.FAILED) {
      throw new ConflictException(`Calculation is not in FAILED status (current: ${calculation.status})`);
    }

    if (calculation.retryCount >= (calculation.maxRetries || 3)) {
      throw new ConflictException('Maximum retry attempts reached');
    }

    // Reset status and increment retry count
    calculation.status = CalculationStatus.REPROCESSING;
    calculation.retryCount++;
    calculation.errorMessage = null;

    const updatedCalculation = await this.calculationRepository.update(id, calculation);

    // Re-queue for processing
    await this.publishToKafka(updatedCalculation);

    return this.toResponseDto(updatedCalculation);
  }

  async retryAllFailedCalculations(): Promise<{ successCount: number; errorCount: number; results: any[]; errors: any[] }> {
    const failedCalculations = await this.calculationRepository.getFailedCalculations(100);
    const results = [];
    const errors = [];

    for (const calculation of failedCalculations) {
      try {
        if (calculation.retryCount >= (calculation.maxRetries || 3)) {
          errors.push({
            calculationId: calculation.id,
            error: 'Maximum retry attempts reached',
          });
          continue;
        }

        const updated = await this.retryCalculation(calculation.id);
        results.push(updated);
      } catch (error) {
        errors.push({
          calculationId: calculation.id,
          error: error.message,
        });
      }
    }

    return {
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors,
    };
  }

  // ============================================================================
  // DISTRIBUTION RULE OPERATIONS
  // ============================================================================

  async createDistributionRule(ruleDto: DistributionRuleDto): Promise<any> {
    const existingRule = await this.calculationRepository.findDistributionRuleByName(ruleDto.name);
    
    if (existingRule) {
      throw new ConflictException(`Distribution rule with name ${ruleDto.name} already exists`);
    }

    const rule = await this.calculationRepository.createDistributionRule({
      id: ruleDto.id || uuidv4(),
      name: ruleDto.name,
      description: ruleDto.description,
      participants: ruleDto.participants,
      conditions: ruleDto.conditions,
      priority: ruleDto.priority || 0,
      isActive: ruleDto.isActive !== undefined ? ruleDto.isActive : true,
      startDate: ruleDto.startDate ? new Date(ruleDto.startDate) : null,
      endDate: ruleDto.endDate ? new Date(ruleDto.endDate) : null,
      createdBy: ruleDto.metadata?.createdBy,
      updatedBy: ruleDto.metadata?.updatedBy,
    });

    return rule;
  }

  async getDistributionRule(id: string): Promise<any> {
    const rule = await this.calculationRepository.findDistributionRuleById(id);
    
    if (!rule) {
      throw new ConflictException(`Distribution rule with ID ${id} not found`);
    }

    return rule;
  }

  async listDistributionRules(
    page: number = 1,
    limit: number = 100,
    isActive?: boolean,
  ): Promise<{ data: any[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const result = await this.calculationRepository.findAllDistributionRules(page, limit, isActive);

    return {
      data: result.data,
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  async updateDistributionRule(id: string, ruleDto: Partial<DistributionRuleDto>): Promise<any> {
    const rule = await this.calculationRepository.updateDistributionRule(id, {
      name: ruleDto.name,
      description: ruleDto.description,
      participants: ruleDto.participants,
      conditions: ruleDto.conditions,
      priority: ruleDto.priority,
      isActive: ruleDto.isActive,
      startDate: ruleDto.startDate ? new Date(ruleDto.startDate) : undefined,
      endDate: ruleDto.endDate ? new Date(ruleDto.endDate) : undefined,
      updatedBy: ruleDto.metadata?.updatedBy,
    });

    if (!rule) {
      throw new ConflictException(`Distribution rule with ID ${id} not found`);
    }

    return rule;
  }

  async deleteDistributionRule(id: string): Promise<void> {
    const result = await this.calculationRepository.deleteDistributionRule(id);
    
    if (!result) {
      throw new ConflictException(`Distribution rule with ID ${id} not found`);
    }
  }

  // ============================================================================
  // STATISTICS AND METRICS
  // ============================================================================

  async getStats(): Promise<any> {
    const stats = await this.calculationRepository.getStats();
    
    return {
      ...stats,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
    };
  }

  async getCalculationHashChain(calculationId: string): Promise<any> {
    const calculation = await this.calculationRepository.findById(calculationId);
    
    if (!calculation) {
      throw new ConflictException(`Calculation with ID ${calculationId} not found`);
    }

    const chain = await this.calculationRepository.getHashChain(calculationId);

    return {
      calculationId: calculation.id,
      chain: chain.map((c) => ({
        id: c.id,
        hash: c.calculationHash,
        previousHash: c.previousHash,
        timestamp: c.calculatedAt,
      })),
      isValid: await this.calculationRepository.verifyHashChain(calculationId),
    };
  }

  async verifyCalculationHashChain(calculationId: string): Promise<boolean> {
    return this.calculationRepository.verifyHashChain(calculationId);
  }

  // ============================================================================
  // KAFKA INTEGRATION
  // ============================================================================

  private async startKafkaConsumer(): Promise<void> {
    const kafkaConfig = this.configService.get('kafka');
    const groupId = kafkaConfig.groupId || 'calculation-service-group';
    const topics = [
      kafkaConfig.topic?.revenueEvents || 'revenue-events',
      kafkaConfig.topic?.calculationRequests || 'calculation-requests',
    ];

    this.logger.log('Starting Kafka consumer...', { groupId, topics });

    for (const topic of topics) {
      await this.kafkaService.consume(
        `${groupId}-${topic}`,
        [topic],
        async (message) => {
          try {
            this.logger.debug('Processing Kafka message', {
              topic: message.topic,
              key: message.key,
              offset: message.offset,
            });

            // Process the message
            if (message.topic === (kafkaConfig.topic?.revenueEvents || 'revenue-events')) {
              await this.processRevenueEvent(message.value);
            } else if (message.topic === (kafkaConfig.topic?.calculationRequests || 'calculation-requests')) {
              await this.processCalculationRequest(message.value);
            }

            // Commit offset
            // Note: In a real implementation, you would commit after successful processing
          } catch (error) {
            this.logger.error('Failed to process Kafka message', error);
          }
        },
      );
    }

    this.logger.log('Kafka consumer started successfully');
  }

  private async processRevenueEvent(event: any): Promise<void> {
    this.logger.log('Processing revenue event for calculation', {
      eventId: event.eventId,
      type: event.type,
    });

    // In a real implementation, this would trigger a calculation
    // For now, just log it
  }

  private async processCalculationRequest(request: any): Promise<void> {
    this.logger.log('Processing calculation request', {
      requestId: request.id,
      eventId: request.eventId,
    });

    // In a real implementation, this would perform the calculation
    // For now, just log it
  }

  private async publishToKafka(calculation: any): Promise<void> {
    try {
      const message: KafkaMessage = {
        topic: this.kafkaTopic,
        key: calculation.id,
        value: {
          calculationId: calculation.id,
          eventId: calculation.eventId,
          distributionRuleId: calculation.distributionRuleId,
          type: calculation.type,
          status: calculation.status,
          totalAmount: calculation.totalAmount,
          grossAmount: calculation.grossAmount,
          netAmount: calculation.netAmount,
          totalDeductions: calculation.totalDeductions,
          currency: calculation.currency,
          calculatedAt: calculation.calculatedAt.toISOString(),
          completedAt: calculation.completedAt?.toISOString(),
          hash: calculation.calculationHash,
          previousHash: calculation.previousHash,
          results: calculation.results,
          errorMessage: calculation.errorMessage,
          retryCount: calculation.retryCount,
          correlationId: calculation.correlationId,
          metadata: calculation.metadata,
        },
        headers: {
          'x-service': this.serviceName,
          'x-version': '1.0',
          'x-timestamp': new Date().toISOString(),
        },
      };

      await this.kafkaService.send(message);
    } catch (error) {
      this.logger.error('Failed to publish calculation to Kafka', error);
      throw new InternalServerErrorException('Failed to publish calculation to Kafka');
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private generateIdempotencyKey(): string {
    return `calc_${Date.now()}_${uuidv4().substring(0, 12)}`;
  }

  private toResponseDto(calculation: any): CalculationResponseDto {
    return {
      id: calculation.id,
      eventId: calculation.eventId,
      type: calculation.type,
      status: calculation.status,
      results: calculation.results || [],
      totalAmount: calculation.totalAmount,
      grossAmount: calculation.grossAmount,
      netAmount: calculation.netAmount,
      totalDeductions: calculation.totalDeductions,
      currency: calculation.currency,
      calculatedAt: calculation.calculatedAt.toISOString(),
      errorMessage: calculation.errorMessage,
      calculationHash: calculation.calculationHash,
      previousHash: calculation.previousHash,
      metadata: calculation.metadata,
    };
  }
}
