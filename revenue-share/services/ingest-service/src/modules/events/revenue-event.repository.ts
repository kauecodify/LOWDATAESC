import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan, LessThan, Between, IsNull, Not } from 'typeorm';
import { RevenueEvent } from './entities/revenue-event.entity';
import { CreateRevenueEventDto, RevenueEventStatus } from './dto/create-revenue-event.dto';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class RevenueEventRepository {
  constructor(
    @InjectRepository(RevenueEvent)
    private readonly repository: Repository<RevenueEvent>,
    private readonly dataSource: DataSource,
  ) {}

  async create(eventData: CreateRevenueEventDto, previousHash?: string): Promise<RevenueEvent> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate event ID if not provided
      const eventId = eventData.id || `evt_${Date.now()}_${uuidv4().substring(0, 8)}`;

      // Calculate net amount if not provided
      const netAmount = eventData.netAmount || this.calculateNetAmount(eventData);

      // Calculate hash for this event
      const eventHash = this.calculateEventHash(eventData, previousHash);

      // Create the event
      const event = this.repository.create({
        eventId,
        type: eventData.type,
        grossAmount: eventData.grossAmount,
        netAmount,
        currency: eventData.currency,
        timestamp: new Date(eventData.timestamp),
        status: RevenueEventStatus.PENDING,
        idempotencyKey: eventData.idempotencyKey,
        source: eventData.source || 'api',
        schemaVersion: eventData.schemaVersion || '1.0',
        merchantId: eventData.metadata?.merchantId,
        customerId: eventData.metadata?.customerId,
        productId: eventData.metadata?.productId,
        transactionId: eventData.metadata?.transactionId,
        externalId: eventData.metadata?.externalId,
        correlationId: eventData.metadata?.correlationId || eventData.idempotencyKey,
        ipAddress: eventData.metadata?.ipAddress,
        userAgent: eventData.metadata?.userAgent,
        deductions: eventData.deductions,
        metadata: eventData.metadata,
        eventHash,
        previousHash,
      });

      const savedEvent = await queryRunner.manager.save(event);
      await queryRunner.commitTransaction();

      return savedEvent;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findById(id: string): Promise<RevenueEvent | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByEventId(eventId: string): Promise<RevenueEvent | null> {
    return this.repository.findOne({ where: { eventId } });
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<RevenueEvent | null> {
    return this.repository.findOne({ where: { idempotencyKey } });
  }

  async findByCorrelationId(correlationId: string): Promise<RevenueEvent[]> {
    return this.repository.find({ where: { correlationId } });
  }

  async findPendingEvents(limit: number = 100): Promise<RevenueEvent[]> {
    return this.repository.find({
      where: {
        status: RevenueEventStatus.PENDING,
        retryCount: LessThan(5), // Max 5 retries
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async findFailedEvents(limit: number = 100): Promise<RevenueEvent[]> {
    return this.repository.find({
      where: {
        status: RevenueEventStatus.FAILED,
        retryCount: LessThan(5),
      },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async findEventsByDateRange(startDate: Date, endDate: Date): Promise<RevenueEvent[]> {
    return this.repository.find({
      where: {
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'ASC' },
    });
  }

  async findEventsByStatus(status: RevenueEventStatus, limit: number = 100): Promise<RevenueEvent[]> {
    return this.repository.find({
      where: { status },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async updateStatus(id: string, status: RevenueEventStatus, errorMessage?: string): Promise<RevenueEvent> {
    const event = await this.findById(id);
    if (!event) {
      throw new Error(`Event with id ${id} not found`);
    }

    // Increment retry count if status is FAILED
    const retryCount = status === RevenueEventStatus.FAILED 
      ? event.retryCount + 1 
      : event.retryCount;

    return this.repository.save({
      ...event,
      status,
      errorMessage,
      retryCount,
      processedAt: status === RevenueEventStatus.PROCESSED ? new Date() : null,
    });
  }

  async markAsProcessed(id: string): Promise<RevenueEvent> {
    return this.updateStatus(id, RevenueEventStatus.PROCESSED);
  }

  async markAsFailed(id: string, errorMessage: string, errorStack?: string): Promise<RevenueEvent> {
    return this.updateStatus(id, RevenueEventStatus.FAILED, errorMessage);
  }

  async incrementRetryCount(id: string): Promise<RevenueEvent> {
    const event = await this.findById(id);
    if (!event) {
      throw new Error(`Event with id ${id} not found`);
    }

    return this.repository.save({
      ...event,
      retryCount: event.retryCount + 1,
      status: RevenueEventStatus.REPROCESSING,
    });
  }

  async getLastEventHash(): Promise<string | null> {
    const lastEvent = await this.repository.findOne({
      where: { eventHash: Not(IsNull()) },
      order: { createdAt: 'DESC' },
    });

    return lastEvent?.eventHash || null;
  }

  async getEventsForReconciliation(startDate: Date, endDate: Date): Promise<RevenueEvent[]> {
    return this.repository.find({
      where: {
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'ASC' },
    });
  }

  async countEventsByStatus(status: RevenueEventStatus): Promise<number> {
    return this.repository.count({ where: { status } });
  }

  async countEventsByDateRange(startDate: Date, endDate: Date): Promise<number> {
    return this.repository.count({
      where: {
        timestamp: Between(startDate, endDate),
      },
    });
  }

  async getStats(): Promise<{
    total: number;
    pending: number;
    processed: number;
    failed: number;
    reprocessing: number;
  }> {
    const [total, pending, processed, failed, reprocessing] = await Promise.all([
      this.repository.count(),
      this.repository.count({ where: { status: RevenueEventStatus.PENDING } }),
      this.repository.count({ where: { status: RevenueEventStatus.PROCESSED } }),
      this.repository.count({ where: { status: RevenueEventStatus.FAILED } }),
      this.repository.count({ where: { status: RevenueEventStatus.REPROCESSING } }),
    ]);

    return {
      total,
      pending,
      processed,
      failed,
      reprocessing,
    };
  }

  private calculateNetAmount(eventData: CreateRevenueEventDto): number {
    if (!eventData.deductions || eventData.deductions.length === 0) {
      return eventData.grossAmount;
    }

    const totalDeductions = eventData.deductions.reduce(
      (sum, deduction) => sum + deduction.amount,
      0,
    );

    return eventData.grossAmount - totalDeductions;
  }

  private calculateEventHash(eventData: CreateRevenueEventDto, previousHash?: string): string {
    // Create a canonical representation of the event
    const canonicalData = {
      eventId: eventData.id || `evt_${Date.now()}_${uuidv4().substring(0, 8)}`,
      type: eventData.type,
      grossAmount: eventData.grossAmount.toFixed(2),
      netAmount: (eventData.netAmount || this.calculateNetAmount(eventData)).toFixed(2),
      currency: eventData.currency,
      timestamp: eventData.timestamp,
      deductions: eventData.deductions || [],
      metadata: eventData.metadata || {},
      previousHash: previousHash || '',
    };

    // Sort keys for consistent hashing
    const sortedData = Object.keys(canonicalData).sort().reduce((obj, key) => {
      obj[key] = canonicalData[key];
      return obj;
    }, {} as Record<string, any>);

    const dataString = JSON.stringify(sortedData);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }
}
