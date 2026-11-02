import { Injectable, OnModuleInit, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RevenueEventRepository } from './revenue-event.repository';
import { CreateRevenueEventDto, RevenueEventStatus, RevenueEventType } from './dto/create-revenue-event.dto';
import { KafkaService, KafkaMessage } from '../../common/kafka/kafka.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { LoggerService } from '../../common/logger/logger.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EventService implements OnModuleInit {
  private readonly logger = new LoggerService();
  private readonly kafkaTopic: string;
  private readonly serviceName: string;

  constructor(
    private readonly eventRepository: RevenueEventRepository,
    private readonly kafkaService: KafkaService,
    private readonly idempotencyService: IdempotencyService,
    private readonly configService: ConfigService,
  ) {
    const kafkaConfig = this.configService.get('kafka');
    const serviceConfig = this.configService.get('service');
    
    this.kafkaTopic = kafkaConfig.topic?.revenueEvents || 'revenue-events';
    this.serviceName = serviceConfig.name || 'ingest-service';
  }

  async onModuleInit() {
    // Start Kafka consumer for processing events
    this.startKafkaConsumer().catch((error) => {
      this.logger.error('Failed to start Kafka consumer', error);
    });
  }

  async createEvent(eventData: CreateRevenueEventDto): Promise<any> {
    const idempotencyKey = eventData.idempotencyKey || this.generateIdempotencyKey();
    const operation = 'create_revenue_event';

    // Check for idempotency
    const { exists, response: cachedResponse } = await this.idempotencyService.checkKey(
      idempotencyKey,
      operation,
    );

    if (exists) {
      this.logger.log('Idempotency: Returning cached response', {
        idempotencyKey,
        operation,
      });
      return cachedResponse;
    }

    // Get previous hash for chain
    const previousHash = await this.eventRepository.getLastEventHash();

    // Create the event
    const event = await this.eventRepository.create(eventData, previousHash);

    // Store response for idempotency
    await this.idempotencyService.setKey(idempotencyKey, operation, {
      id: event.id,
      eventId: event.eventId,
      status: event.status,
      timestamp: event.timestamp,
      message: 'Event created successfully',
    });

    // Publish to Kafka for async processing
    await this.publishToKafka(event);

    this.logger.log('Event created and published to Kafka', {
      eventId: event.eventId,
      idempotencyKey,
    });

    return {
      id: event.id,
      eventId: event.eventId,
      status: event.status,
      timestamp: event.timestamp,
      hash: event.eventHash,
      previousHash: event.previousHash,
      message: 'Event created and queued for processing',
    };
  }

  async createBatchEvents(eventsData: CreateRevenueEventDto[]): Promise<any> {
    if (!eventsData || eventsData.length === 0) {
      throw new ConflictException('No events provided');
    }

    if (eventsData.length > 100) {
      throw new ConflictException('Maximum batch size is 100 events');
    }

    const results = [];
    const errors = [];
    const previousHash = await this.eventRepository.getLastEventHash();

    for (const eventData of eventsData) {
      try {
        const idempotencyKey = eventData.idempotencyKey || this.generateIdempotencyKey();
        const operation = `create_revenue_event_batch_${Date.now()}`;

        // Check for idempotency
        const { exists } = await this.idempotencyService.checkKey(
          idempotencyKey,
          operation,
        );

        if (exists) {
          this.logger.warn('Batch: Duplicate event detected, skipping', {
            idempotencyKey,
          });
          continue;
        }

        // Create the event with updated previous hash
        const event = await this.eventRepository.create(eventData, previousHash);
        
        // Update previous hash for next iteration
        // previousHash = event.eventHash;

        // Store response for idempotency
        await this.idempotencyService.setKey(idempotencyKey, operation, {
          id: event.id,
          eventId: event.eventId,
          status: event.status,
        });

        // Publish to Kafka
        await this.publishToKafka(event);

        results.push({
          id: event.id,
          eventId: event.eventId,
          status: event.status,
        });
      } catch (error) {
        this.logger.error('Failed to create event in batch', error);
        errors.push({
          event: eventData,
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

  async getEvent(eventId: string): Promise<any> {
    const event = await this.eventRepository.findByEventId(eventId);
    
    if (!event) {
      throw new ConflictException(`Event with ID ${eventId} not found`);
    }

    return {
      id: event.id,
      eventId: event.eventId,
      type: event.type,
      grossAmount: event.grossAmount,
      netAmount: event.netAmount,
      currency: event.currency,
      status: event.status,
      timestamp: event.timestamp,
      processedAt: event.processedAt,
      deductions: event.deductions,
      metadata: event.metadata,
      errorMessage: event.errorMessage,
      retryCount: event.retryCount,
      hash: event.eventHash,
      previousHash: event.previousHash,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  async listEvents(
    page: number = 1,
    limit: number = 100,
    status?: RevenueEventStatus,
    type?: RevenueEventType,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (startDate && endDate) {
      where.timestamp = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.timestamp = MoreThan(new Date(startDate));
    } else if (endDate) {
      where.timestamp = LessThan(new Date(endDate));
    }

    const [events, total] = await Promise.all([
      this.eventRepository.repository.find({
        where,
        order: { timestamp: 'DESC' },
        skip,
        take: limit,
      }),
      this.eventRepository.repository.count({ where }),
    ]);

    return {
      data: events.map((event) => ({
        id: event.id,
        eventId: event.eventId,
        type: event.type,
        grossAmount: event.grossAmount,
        netAmount: event.netAmount,
        currency: event.currency,
        status: event.status,
        timestamp: event.timestamp,
        processedAt: event.processedAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async retryEvent(eventId: string): Promise<any> {
    const event = await this.eventRepository.findByEventId(eventId);
    
    if (!event) {
      throw new ConflictException(`Event with ID ${eventId} not found`);
    }

    if (event.status !== RevenueEventStatus.FAILED) {
      throw new ConflictException(`Event is not in FAILED status (current: ${event.status})`);
    }

    if (event.retryCount >= 5) {
      throw new ConflictException('Maximum retry attempts reached (5)');
    }

    // Reset status and increment retry count
    const updatedEvent = await this.eventRepository.incrementRetryCount(event.id);

    // Re-publish to Kafka
    await this.publishToKafka(updatedEvent);

    this.logger.log('Event retried', {
      eventId: updatedEvent.eventId,
      retryCount: updatedEvent.retryCount,
    });

    return {
      id: updatedEvent.id,
      eventId: updatedEvent.eventId,
      status: updatedEvent.status,
      retryCount: updatedEvent.retryCount,
      message: 'Event retried and queued for processing',
    };
  }

  async retryAllFailedEvents(): Promise<any> {
    const failedEvents = await this.eventRepository.findFailedEvents(100);
    const results = [];
    const errors = [];

    for (const event of failedEvents) {
      try {
        if (event.retryCount >= 5) {
          errors.push({
            eventId: event.eventId,
            error: 'Maximum retry attempts reached',
          });
          continue;
        }

        const updatedEvent = await this.eventRepository.incrementRetryCount(event.id);
        await this.publishToKafka(updatedEvent);

        results.push({
          eventId: updatedEvent.eventId,
          retryCount: updatedEvent.retryCount,
        });
      } catch (error) {
        errors.push({
          eventId: event.eventId,
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

  async getStats(): Promise<any> {
    const stats = await this.eventRepository.getStats();
    
    return {
      ...stats,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
    };
  }

  async correctEvent(
    eventId: string,
    corrections: Record<string, any>,
    justification: string,
    approvedBy: string,
  ): Promise<any> {
    const event = await this.eventRepository.findByEventId(eventId);
    
    if (!event) {
      throw new ConflictException(`Event with ID ${eventId} not found`);
    }

    if (event.status !== RevenueEventStatus.PROCESSED) {
      throw new ConflictException(`Cannot correct event that is not PROCESSED (current: ${event.status})`);
    }

    // Apply corrections
    const updatedData = { ...event, ...corrections };

    // Save correction to audit trail (in a real implementation, this would be in a separate table)
    // For now, we'll just update the event with correction metadata
    const updatedEvent = await this.eventRepository.repository.save({
      ...updatedData,
      metadata: {
        ...event.metadata,
        corrections: {
          ...corrections,
          appliedAt: new Date().toISOString(),
          appliedBy: approvedBy,
          justification,
        },
      },
      status: RevenueEventStatus.PROCESSED, // Still processed, but with corrections
    });

    this.logger.log('Event corrected', {
      eventId: updatedEvent.eventId,
      corrections,
      justification,
      approvedBy,
    });

    return {
      id: updatedEvent.id,
      eventId: updatedEvent.eventId,
      message: 'Event corrected successfully',
    };
  }

  async getEventHashChain(eventId: string): Promise<any> {
    const event = await this.eventRepository.findByEventId(eventId);
    
    if (!event) {
      throw new ConflictException(`Event with ID ${eventId} not found`);
    }

    // Get previous events for chain verification
    const previousEvents = await this.eventRepository.repository.find({
      where: {
        timestamp: LessThan(event.timestamp),
      },
      order: { timestamp: 'DESC' },
      take: 10,
    });

    const chain = [];
    let currentHash = event.eventHash;
    let previousHash = event.previousHash;

    chain.push({
      eventId: event.eventId,
      hash: currentHash,
      previousHash,
      timestamp: event.timestamp,
    });

    // Build chain backwards
    for (const prevEvent of previousEvents) {
      if (prevEvent.eventHash === previousHash) {
        chain.push({
          eventId: prevEvent.eventId,
          hash: prevEvent.eventHash,
          previousHash: prevEvent.previousHash,
          timestamp: prevEvent.timestamp,
        });
        previousHash = prevEvent.previousHash;
      }
    }

    return {
      eventId: event.eventId,
      chain,
      isValid: this.verifyHashChain(chain),
    };
  }

  private async startKafkaConsumer(): Promise<void> {
    const kafkaConfig = this.configService.get('kafka');
    const groupId = kafkaConfig.groupId || 'ingest-service-group';

    this.logger.log('Starting Kafka consumer...', { groupId, topic: this.kafkaTopic });

    await this.kafkaService.consume(
      groupId,
      [this.kafkaTopic],
      async (message) => {
        try {
          this.logger.debug('Processing Kafka message', {
            topic: message.topic,
            key: message.key,
            offset: message.offset,
          });

          // In a real implementation, this would process the event
          // For now, we just log it
          this.logger.log('Kafka message processed', {
            topic: message.topic,
            value: message.value,
          });

          // Commit offset
          // Note: In a real implementation, you would commit after successful processing
        } catch (error) {
          this.logger.error('Failed to process Kafka message', error);
        }
      },
    );

    this.logger.log('Kafka consumer started successfully');
  }

  private async publishToKafka(event: any): Promise<void> {
    try {
      const message: KafkaMessage = {
        topic: this.kafkaTopic,
        key: event.eventId,
        value: {
          eventId: event.eventId,
          id: event.id,
          type: event.type,
          grossAmount: event.grossAmount,
          netAmount: event.netAmount,
          currency: event.currency,
          timestamp: event.timestamp.toISOString(),
          status: event.status,
          metadata: event.metadata,
          deductions: event.deductions,
          hash: event.eventHash,
          previousHash: event.previousHash,
          createdAt: event.createdAt.toISOString(),
        },
        headers: {
          'x-service': this.serviceName,
          'x-version': '1.0',
          'x-timestamp': new Date().toISOString(),
        },
      };

      await this.kafkaService.send(message);
    } catch (error) {
      this.logger.error('Failed to publish event to Kafka', error);
      throw new InternalServerErrorException('Failed to publish event to Kafka');
    }
  }

  private generateIdempotencyKey(): string {
    return `ingest_${Date.now()}_${uuidv4().substring(0, 12)}`;
  }

  private verifyHashChain(chain: any[]): boolean {
    if (chain.length === 0) {
      return false;
    }

    // Verify each link in the chain
    for (let i = 0; i < chain.length - 1; i++) {
      const current = chain[i];
      const next = chain[i + 1];

      if (current.previousHash !== next.hash) {
        return false;
      }
    }

    return true;
  }
}

// Import Between and other TypeORM functions
import { Between, MoreThan, LessThan } from 'typeorm';
