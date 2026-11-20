import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, Producer, KafkaConfig, SASLOptions, logLevel } from 'kafkajs';
import { LoggerService } from '../logger/logger.service';

interface KafkaMessage {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: any;
  timestamp: string;
  headers?: Record<string, Buffer>;
}

@Injectable()
export class KafkaService implements OnModuleDestroy {
  private kafka: Kafka;
  private consumers: Map<string, Consumer> = new Map();
  private producer: Producer;
  private readonly logger = new LoggerService();

  constructor(private configService: ConfigService) {
    const kafkaConfig = this.configService.get('kafka');
    
    const brokers = kafkaConfig?.brokers || ['kafka:9092'];
    const clientId = kafkaConfig?.clientId || 'split-payment-service';
    const ssl = kafkaConfig?.ssl === true;
    const sasl = kafkaConfig?.sasl || {};

    const kafkaOptions: KafkaConfig = {
      clientId,
      brokers,
      logLevel: this.getLogLevel(this.configService.get('logging.level')),
    };

    if (ssl) {
      kafkaOptions.ssl = true;
    }

    if (sasl?.mechanism) {
      const saslOptions: SASLOptions = {
        mechanism: sasl.mechanism as any,
      };
      if (sasl.username) {
        saslOptions.username = sasl.username;
      }
      if (sasl.password) {
        saslOptions.password = sasl.password;
      }
      kafkaOptions.sasl = saslOptions;
    }

    this.kafka = new Kafka(kafkaOptions);
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
    this.logger.log('Kafka producer connected');
  }

  async onModuleDestroy() {
    // Disconnect all consumers
    for (const consumer of this.consumers.values()) {
      await consumer.disconnect().catch((error) => {
        this.logger.error('Failed to disconnect Kafka consumer', error);
      });
    }
    this.consumers.clear();

    // Disconnect producer
    await this.producer.disconnect().catch((error) => {
      this.logger.error('Failed to disconnect Kafka producer', error);
    });

    this.logger.log('Kafka service shutdown complete');
  }

  private getLogLevel(level?: string): logLevel {
    switch (level?.toLowerCase()) {
      case 'error':
        return logLevel.ERROR;
      case 'warn':
        return logLevel.WARN;
      case 'info':
        return logLevel.INFO;
      case 'debug':
        return logLevel.DEBUG;
      default:
        return logLevel.WARN;
    }
  }

  async consume(groupId: string, topics: string[], callback: (message: KafkaMessage) => Promise<void>, fromBeginning: boolean = false): Promise<void> {
    try {
      const consumer: Consumer = this.kafka.consumer({ groupId });
      
      // Subscribe to topics
      await consumer.subscribe({ topics, fromBeginning });
      
      // Start consuming
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const key = message.key ? message.key.toString() : null;
            const value = message.value ? JSON.parse(message.value.toString()) : null;
            const headers: Record<string, Buffer> = {};
            
            if (message.headers) {
              for (const [key, value] of Object.entries(message.headers)) {
                headers[key] = value;
              }
            }

            const kafkaMessage: KafkaMessage = {
              topic,
              partition,
              offset: message.offset,
              key,
              value,
              timestamp: message.timestamp,
              headers,
            };

            await callback(kafkaMessage);
            
            // Manually commit offset
            await consumer.commitOffsets([{ topic, partition, offset: message.offset }]);
          } catch (error) {
            this.logger.error('Error processing Kafka message', {
              topic,
              partition,
              offset: message.offset,
              error: error.message,
            });
            throw error;
          }
        },
      });

      this.consumers.set(groupId, consumer);
      this.logger.log(`Kafka consumer started for group: ${groupId}, topics: ${topics.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to start Kafka consumer for group: ${groupId}`, error);
      throw error;
    }
  }

  async produce(topic: string, messages: any[], key?: string | null): Promise<void> {
    try {
      const kafkaMessages = messages.map((message) => {
        const value = typeof message === 'string' ? message : JSON.stringify(message);
        return {
          key: key || null,
          value,
        };
      });

      await this.producer.send({
        topic,
        messages: kafkaMessages,
      });

      this.logger.debug(`Kafka message produced to topic: ${topic}`, {
        messageCount: messages.length,
      });
    } catch (error) {
      this.logger.error(`Failed to produce Kafka message to topic: ${topic}`, error);
      throw error;
    }
  }

  async produceWithHeaders(topic: string, message: any, key?: string | null, headers?: Record<string, string>): Promise<void> {
    try {
      const value = typeof message === 'string' ? message : JSON.stringify(message);
      
      const kafkaHeaders: Record<string, Buffer> = {};
      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          kafkaHeaders[key] = Buffer.from(value);
        }
      }

      await this.producer.send({
        topic,
        messages: [{
          key: key || null,
          value,
          headers: kafkaHeaders,
        }],
      });

      this.logger.debug(`Kafka message produced to topic: ${topic} with headers`, {
        key,
        headerCount: Object.keys(headers || {}).length,
      });
    } catch (error) {
      this.logger.error(`Failed to produce Kafka message with headers to topic: ${topic}`, error);
      throw error;
    }
  }

  async sendToDeadLetter(topic: string, message: any, key?: string | null, reason?: string): Promise<void> {
    const dlqTopic = this.configService.get('kafka.topic.deadLetter') || 'split-payment-dlq';
    
    const dlqMessage = {
      originalTopic: topic,
      originalMessage: message,
      timestamp: new Date().toISOString(),
      reason: reason || 'Processing error',
    };

    await this.produce(dlqTopic, [dlqMessage], key);
    this.logger.warn(`Message sent to DLQ from topic: ${topic}`, {
      key,
      reason,
    });
  }

  getConsumer(groupId: string): Consumer | undefined {
    return this.consumers.get(groupId);
  }

  async pauseConsumer(groupId: string): Promise<void> {
    const consumer = this.consumers.get(groupId);
    if (consumer) {
      await consumer.pause([{ topic: '.*' }]);
      this.logger.log(`Kafka consumer paused: ${groupId}`);
    }
  }

  async resumeConsumer(groupId: string): Promise<void> {
    const consumer = this.consumers.get(groupId);
    if (consumer) {
      await consumer.resume([{ topic: '.*' }]);
      this.logger.log(`Kafka consumer resumed: ${groupId}`);
    }
  }

  async disconnectConsumer(groupId: string): Promise<void> {
    const consumer = this.consumers.get(groupId);
    if (consumer) {
      await consumer.disconnect();
      this.consumers.delete(groupId);
      this.logger.log(`Kafka consumer disconnected: ${groupId}`);
    }
  }
}
