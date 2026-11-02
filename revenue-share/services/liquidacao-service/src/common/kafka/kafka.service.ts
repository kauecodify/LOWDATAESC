import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, Producer, logLevel, SASLOptions, SSLOptions } from 'kafkajs';
import { LoggerService } from '../logger/logger.service';

export interface KafkaMessage {
  topic: string;
  partition?: number;
  key?: string;
  value: any;
  headers?: Record<string, string>;
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly consumers: Map<string, Consumer> = new Map();
  private readonly producers: Map<string, Producer> = new Map();
  private readonly logger = new LoggerService('KafkaService');

  constructor(private readonly configService: ConfigService) {
    const kafkaConfig = this.configService.get('kafka');
    const ssl = kafkaConfig.ssl || false;
    const sasl = kafkaConfig.sasl || { mechanism: 'plain', username: '', password: '' };

    const sslOptions: SSLOptions | false = ssl
      ? {
          rejectUnauthorized: false,
          ca: [this.loadCert('/certs/ca.crt')],
          cert: this.loadCert('/certs/service.crt'),
          key: this.loadCert('/certs/service.key'),
        }
      : false;

    const saslOptions: SASLOptions | false = sasl.username && sasl.password
      ? {
          mechanism: sasl.mechanism as any,
          username: sasl.username,
          password: sasl.password,
        }
      : false;

    this.kafka = new Kafka({
      clientId: kafkaConfig.clientId || 'liquidacao-service',
      brokers: kafkaConfig.brokers || ['kafka:9092'],
      ssl: sslOptions,
      sasl: saslOptions,
      logLevel: logLevel.INFO,
      connectionTimeout: 5000,
      requestTimeout: 30000,
      retry: {
        initialRetryTime: 1000,
        retries: kafkaConfig.retries || 3,
      },
    });
  }

  private loadCert(path: string): string {
    try {
      const fs = require('fs');
      return fs.readFileSync(path, 'utf8');
    } catch (error) {
      this.logger.warn(`Failed to load certificate from ${path}, using empty string`, error);
      return '';
    }
  }

  async onModuleInit() {
    this.logger.log('Kafka service initializing...');
    
    // Initialize default producer
    await this.getProducer();
    
    this.logger.log('Kafka service initialized successfully');
  }

  async onModuleDestroy() {
    this.logger.log('Kafka service shutting down...');
    
    // Disconnect all consumers and producers
    for (const [, consumer] of this.consumers) {
      await consumer.disconnect().catch(() => {});
    }
    for (const [, producer] of this.producers) {
      await producer.disconnect().catch(() => {});
    }
    
    this.logger.log('Kafka service shut down successfully');
  }

  async getConsumer(groupId: string, fromBeginning: boolean = false): Promise<Consumer> {
    const key = `${groupId}-${fromBeginning}`;
    
    if (!this.consumers.has(key)) {
      const consumer = this.kafka.consumer({
        groupId,
        heartbeatInterval: 3000,
        sessionTimeout: 30000,
        retry: {
          initialRetryTime: 100,
          retries: 5,
        },
      });

      await consumer.connect();
      
      if (fromBeginning) {
        // Subscribe to all topics and seek to beginning
        await consumer.subscribe({ topics: this.getAllTopics(), fromBeginning: true });
      } else {
        await consumer.subscribe({ topics: this.getAllTopics() });
      }

      this.consumers.set(key, consumer);
      this.logger.log(`Created new Kafka consumer for group: ${groupId}`);
    }

    return this.consumers.get(key);
  }

  async getProducer(): Promise<Producer> {
    if (!this.producers.has('default')) {
      const producer = this.kafka.producer({
        allowAutoTopicCreation: false,
        idempotent: true,
        maxInFlightRequests: 5,
        retry: {
          initialRetryTime: 100,
          retries: 5,
        },
      });

      await producer.connect();
      this.producers.set('default', producer);
      this.logger.log('Created new Kafka producer');
    }

    return this.producers.get('default');
  }

  async send(message: KafkaMessage): Promise<void> {
    const producer = await this.getProducer();
    const kafkaConfig = this.configService.get('kafka');
    
    try {
      await producer.send({
        topic: message.topic,
        messages: [
          {
            key: message.key || this.generateMessageKey(),
            value: JSON.stringify(message.value),
            headers: message.headers,
          },
        ],
      });
      
      this.logger.debug(`Sent message to topic: ${message.topic}`, {
        key: message.key,
        partition: message.partition,
      });
    } catch (error) {
      this.logger.error(`Failed to send message to topic: ${message.topic}`, error);
      throw error;
    }
  }

  async consume(
    groupId: string,
    topics: string[],
    callback: (message: any) => Promise<void>,
    fromBeginning: boolean = false,
  ): Promise<void> {
    const consumer = await this.getConsumer(groupId, fromBeginning);
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = JSON.parse(message.value.toString());
          
          this.logger.debug(`Consumed message from topic: ${topic}`, {
            partition,
            key: message.key?.toString(),
            offset: message.offset,
          });

          await callback({
            topic,
            partition,
            key: message.key?.toString(),
            value,
            headers: this.parseHeaders(message.headers),
            offset: message.offset,
            timestamp: message.timestamp,
          });
        } catch (error) {
          this.logger.error(`Failed to process message from topic: ${topic}`, error);
          // Continue to next message
        }
      },
    });
  }

  private parseHeaders(headers: any): Record<string, string> {
    const result: Record<string, string> = {};
    if (!headers) return result;
    
    for (const [key, value] of Object.entries(headers)) {
      if (Buffer.isBuffer(value)) {
        result[key] = value.toString('utf8');
      } else if (typeof value === 'string') {
        result[key] = value;
      }
    }
    
    return result;
  }

  async commitOffsets(consumer: Consumer): Promise<void> {
    try {
      await consumer.commitOffsets();
      this.logger.debug('Committed Kafka offsets');
    } catch (error) {
      this.logger.error('Failed to commit Kafka offsets', error);
      throw error;
    }
  }

  async seekToBeginning(consumer: Consumer, topics: string[]): Promise<void> {
    for (const topic of topics) {
      const partitions = await this.getPartitionsForTopic(topic);
      for (const partition of partitions) {
        await consumer.seek({ topic, partition, offset: '0' });
      }
    }
  }

  async getPartitionsForTopic(topic: string): Promise<number[]> {
    const admin = this.kafka.admin();
    await admin.connect();
    
    try {
      const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
      const topicMetadata = metadata.topics.find(t => t.name === topic);
      
      if (!topicMetadata) {
        throw new Error(`Topic ${topic} not found`);
      }
      
      return topicMetadata.partitions.map(p => p.partitionId);
    } finally {
      await admin.disconnect();
    }
  }

  async getTopicOffsets(topic: string): Promise<Record<number, string>> {
    const consumer = await this.getConsumer('offset-checker', true);
    const partitions = await this.getPartitionsForTopic(topic);
    
    const offsets: Record<number, string> = {};
    
    for (const partition of partitions) {
      const [offset] = await consumer.queryOffsets([{ topic, partition, time: Date.now() }]);
      offsets[partition] = offset;
    }
    
    return offsets;
  }

  async getProducerMetadata(): Promise<any> {
    try {
      const producer = await this.getProducer();
      const admin = this.kafka.admin();
      await admin.connect();
      
      const metadata = await admin.fetchMetadata();
      
      await admin.disconnect();
      
      return {
        brokers: metadata.brokers.map(b => ({ host: b.host, port: b.port })),
        topics: metadata.topics.map(t => t.name),
      };
    } catch (error) {
      this.logger.error('Failed to get producer metadata', error);
      return { brokers: [], topics: [] };
    }
  }

  private getAllTopics(): string[] {
    const kafkaConfig = this.configService.get('kafka');
    return [
      kafkaConfig.topic?.settlementInstructions || 'settlement-instructions',
      kafkaConfig.topic?.settlementResults || 'settlement-results',
      kafkaConfig.topic?.settlementCallbacks || 'settlement-callbacks',
      kafkaConfig.topic?.deadLetter || 'liquidacao-dlq',
    ];
  }

  private generateMessageKey(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
