import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../services/logger.service';

interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
}

interface CounterMetric extends Metric {
  type: 'counter';
  value: number;
}

interface GaugeMetric extends Metric {
  type: 'gauge';
  value: number;
}

interface HistogramMetric extends Metric {
  type: 'histogram';
  value: number;
  count: number;
  sum: number;
  buckets: Record<string, number>;
}

@Injectable()
export class PoolMetrics implements OnModuleDestroy {
  private readonly logger = new LoggerService();
  private isRunning: boolean = false;
  private loggingInterval: NodeJS.Timeout;
  private metrics: Map<string, Metric> = new Map();

  // Counters
  private transactionsSubmitted: number = 0;
  private transactionsProcessed: number = 0;
  private transactionsFailed: number = 0;
  private transactionsByStatus: Map<string, number> = new Map();

  // Gauges
  private queueSize: number = 0;
  private activeWorkers: number = 0;
  private processingTime: number = 0;

  // Histograms
  private processingTimeHistogram: number[] = [];

  constructor(
    private configService: ConfigService,
    private poolLogger: LoggerService,
  ) {
    // Initialize status counters
    ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].forEach((status) => {
      this.transactionsByStatus.set(status, 0);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Pool Metrics is already running');
      return;
    }

    this.isRunning = true;

    const metricsConfig = this.configService.get('metrics');
    const loggingConfig = metricsConfig?.logging || {};

    if (loggingConfig.enabled) {
      const interval = loggingConfig.interval || 60000;
      
      this.loggingInterval = setInterval(() => {
        try {
          this.logMetrics();
        } catch (error) {
          this.logger.error('Failed to log metrics', error);
        }
      }, interval);

      // Log initial metrics
      this.logMetrics();
    }

    this.logger.log('Pool Metrics started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Pool Metrics is not running');
      return;
    }

    clearInterval(this.loggingInterval);
    this.isRunning = false;

    this.logger.log('Pool Metrics stopped');
  }

  async onModuleDestroy() {
    await this.stop();
  }

  // Counter methods
  incrementTransactionsSubmitted(): void {
    this.transactionsSubmitted++;
    this.updateCounterMetric('transactions_submitted', this.transactionsSubmitted);
  }

  incrementTransactionsProcessed(): void {
    this.transactionsProcessed++;
    this.updateCounterMetric('transactions_processed', this.transactionsProcessed);
  }

  incrementTransactionsFailed(): void {
    this.transactionsFailed++;
    this.updateCounterMetric('transactions_failed', this.transactionsFailed);
  }

  incrementTransactionsByStatus(status: string): void {
    const current = this.transactionsByStatus.get(status) || 0;
    this.transactionsByStatus.set(status, current + 1);
    this.updateCounterMetric(`transactions_${status.toLowerCase()}`, current + 1, { status });
  }

  private updateCounterMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric: CounterMetric = {
      name,
      type: 'counter',
      value,
      labels,
      timestamp: new Date(),
    };
    this.metrics.set(name, metric);
  }

  // Gauge methods
  setQueueSize(size: number): void {
    this.queueSize = size;
    this.updateGaugeMetric('queue_size', size);
  }

  setActiveWorkers(count: number): void {
    this.activeWorkers = count;
    this.updateGaugeMetric('active_workers', count);
  }

  setProcessingTime(time: number): void {
    this.processingTime = time;
    this.updateGaugeMetric('processing_time_ms', time);
  }

  private updateGaugeMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric: GaugeMetric = {
      name,
      type: 'gauge',
      value,
      labels,
      timestamp: new Date(),
    };
    this.metrics.set(name, metric);
  }

  // Histogram methods
  recordProcessingTime(time: number): void {
    this.processingTimeHistogram.push(time);
    
    // Keep only last 1000 measurements
    if (this.processingTimeHistogram.length > 1000) {
      this.processingTimeHistogram.shift();
    }

    this.updateHistogramMetric('processing_time_histogram', time);
  }

  private updateHistogramMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    const buckets = this.calculateBuckets(value);
    const count = this.processingTimeHistogram.length;
    const sum = this.processingTimeHistogram.reduce((a, b) => a + b, 0);

    const metric: HistogramMetric = {
      name,
      type: 'histogram',
      value,
      count,
      sum,
      labels,
      timestamp: new Date(),
      buckets,
    };
    this.metrics.set(name, metric);
  }

  private calculateBuckets(value: number): Record<string, number> {
    const buckets: Record<string, number> = {};
    const predefinedBuckets = [10, 50, 100, 500, 1000, 5000, 10000, 30000, 60000];

    for (const bucket of predefinedBuckets) {
      const count = this.processingTimeHistogram.filter((t) => t <= bucket).length;
      buckets[`${bucket}ms`] = count;
    }

    return buckets;
  }

  // Get metrics
  getMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  getSummary(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, any>;
  } {
    const counters: Record<string, number> = {};
    const gauges: Record<string, number> = {};
    const histograms: Record<string, any> = {};

    for (const metric of this.metrics.values()) {
      switch (metric.type) {
        case 'counter':
          counters[metric.name] = metric.value;
          break;
        case 'gauge':
          gauges[metric.name] = metric.value;
          break;
        case 'histogram':
          histograms[metric.name] = {
            count: (metric as HistogramMetric).count,
            sum: (metric as HistogramMetric).sum,
            avg: (metric as HistogramMetric).sum / (metric as HistogramMetric).count || 0,
            buckets: (metric as HistogramMetric).buckets,
          };
          break;
      }
    }

    return {
      counters,
      gauges,
      histograms,
    };
  }

  // Log metrics
  private logMetrics(): void {
    const summary = this.getSummary();

    this.logger.log('Pool Metrics', {
      counters: summary.counters,
      gauges: summary.gauges,
      histograms: {
        processing_time: summary.histograms['processing_time_histogram'],
      },
    });
  }

  // Reset metrics
  reset(): void {
    this.transactionsSubmitted = 0;
    this.transactionsProcessed = 0;
    this.transactionsFailed = 0;
    this.transactionsByStatus.clear();
    this.queueSize = 0;
    this.activeWorkers = 0;
    this.processingTime = 0;
    this.processingTimeHistogram = [];
    this.metrics.clear();

    // Re-initialize status counters
    ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].forEach((status) => {
      this.transactionsByStatus.set(status, 0);
    });

    this.logger.log('Pool Metrics reset');
  }

  // Prometheus metrics (stub)
  async getPrometheusMetrics(): Promise<string> {
    const summary = this.getSummary();

    let metrics = '# HELP pool_transactions_submitted_total Total number of transactions submitted\n';
    metrics += `# TYPE pool_transactions_submitted_total counter\n`;
    metrics += `pool_transactions_submitted_total ${summary.counters.transactions_submitted || 0}\n\n`;

    metrics += '# HELP pool_transactions_processed_total Total number of transactions processed\n';
    metrics += `# TYPE pool_transactions_processed_total counter\n`;
    metrics += `pool_transactions_processed_total ${summary.counters.transactions_processed || 0}\n\n`;

    metrics += '# HELP pool_transactions_failed_total Total number of transactions failed\n';
    metrics += `# TYPE pool_transactions_failed_total counter\n`;
    metrics += `pool_transactions_failed_total ${summary.counters.transactions_failed || 0}\n\n`;

    metrics += '# HELP pool_queue_size Current queue size\n';
    metrics += `# TYPE pool_queue_size gauge\n`;
    metrics += `pool_queue_size ${summary.gauges.queue_size || 0}\n\n`;

    metrics += '# HELP pool_active_workers Number of active workers\n';
    metrics += `# TYPE pool_active_workers gauge\n`;
    metrics += `pool_active_workers ${summary.gauges.active_workers || 0}\n\n`;

    metrics += '# HELP pool_processing_time_ms Processing time in milliseconds\n';
    metrics += `# TYPE pool_processing_time_ms gauge\n`;
    metrics += `pool_processing_time_ms ${summary.gauges.processing_time_ms || 0}\n\n`;

    if (summary.histograms.processing_time_histogram) {
      const hist = summary.histograms.processing_time_histogram;
      metrics += '# HELP pool_processing_time_histogram Processing time histogram\n';
      metrics += `# TYPE pool_processing_time_histogram histogram\n`;
      metrics += `pool_processing_time_histogram_bucket{le="10"} ${hist.buckets['10ms'] || 0}\n`;
      metrics += `pool_processing_time_histogram_bucket{le="50"} ${hist.buckets['50ms'] || 0}\n`;
      metrics += `pool_processing_time_histogram_bucket{le="100"} ${hist.buckets['100ms'] || 0}\n`;
      metrics += `pool_processing_time_histogram_bucket{le="500"} ${hist.buckets['500ms'] || 0}\n`;
      metrics += `pool_processing_time_histogram_bucket{le="1000"} ${hist.buckets['1000ms'] || 0}\n`;
      metrics += `pool_processing_time_histogram_bucket{le="5000"} ${hist.buckets['5000ms'] || 0}\n`;
      metrics += `pool_processing_time_histogram_bucket{le="10000"} ${hist.buckets['10000ms'] || 0}\n`;
      metrics += `pool_processing_time_histogram_bucket{le="30000"} ${hist.buckets['30000ms'] || 0}\n`;
      metrics += `pool_processing_time_histogram_bucket{le="60000"} ${hist.buckets['60000ms'] || 0}\n`;
      metrics += `pool_processing_time_histogram_bucket{le="+Inf"} ${hist.count || 0}\n`;
      metrics += `pool_processing_time_histogram_sum ${hist.sum || 0}\n`;
      metrics += `pool_processing_time_histogram_count ${hist.count || 0}\n\n`;
    }

    return metrics;
  }
}
