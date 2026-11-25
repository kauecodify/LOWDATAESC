import { createHash } from 'node:crypto';
import { AuditRecord } from './types';

export const GENESIS_HASH = '0'.repeat(64);

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// Serialização canônica (chaves ordenadas recursivamente) para hashes determinísticos.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(function (item) { return canonicalJson(item); }).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort();
    const parts: string[] = [];
    for (const key of keys) {
      parts.push(JSON.stringify(key) + ':' + canonicalJson(source[key]));
    }
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(value);
}

// Trilha de auditoria imutável: hash SHA-256 encadeado, compatível com
// requisitos de trilhas (BCB Res. 3.638/13 art. 5, TCU RDB, LGPD art. 37).
export class AuditTrail {
  readonly chainId: string;
  private records: AuditRecord[] = [];

  constructor(chainId: string) {
    this.chainId = chainId;
    const genesis: AuditRecord = {
      sequence: 0,
      timestamp: new Date().toISOString(),
      event: 'AUDIT_CHAIN_GENESIS',
      payload: { chainId: chainId },
      previousHash: GENESIS_HASH,
      recordHash: ''
    };
    genesis.recordHash = this.hashRecord(genesis);
    this.records.push(genesis);
  }

  private hashRecord(record: AuditRecord): string {
    return sha256Hex(record.previousHash + '|' + record.sequence + '|' + record.timestamp + '|' + record.event + '|' + canonicalJson(record.payload));
  }

  get lastHash(): string {
    return this.records[this.records.length - 1].recordHash;
  }

  getRecords(): AuditRecord[] {
    return this.records.slice();
  }

  append(event: string, payload: Record<string, unknown>): AuditRecord {
    const prev = this.records[this.records.length - 1];
    const record: AuditRecord = {
      sequence: prev.sequence + 1,
      timestamp: new Date().toISOString(),
      event: event,
      payload: payload,
      previousHash: prev.recordHash,
      recordHash: ''
    };
    record.recordHash = this.hashRecord(record);
    this.records.push(record);
    return record;
  }

  verifyChain(): boolean {
    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];
      if (record.recordHash !== this.hashRecord(record)) return false;
      if (i > 0 && record.previousHash !== this.records[i - 1].recordHash) return false;
      if (i === 0 && record.previousHash !== GENESIS_HASH) return false;
    }
    return true;
  }

  // Prova criptográfica final: payload assinado com SHA-256 duplo (hash do payload + hash da cadeia).
  sealFinalPayload(event: string, finalPayload: Record<string, unknown>): AuditRecord {
    const proofPayload = {
      finalPayload: finalPayload,
      chainId: this.chainId,
      chainHeadBeforeSeal: this.lastHash
    };
    const sealed = this.append(event, { canonical: canonicalJson(proofPayload), proof: sha256Hex(sha256Hex(canonicalJson(proofPayload)) + this.lastHash) });
    return sealed;
  }

  toReport(): string {
    const lines: string[] = ['Trilha de auditoria encadeada (chainId: ' + this.chainId + ')'];
    for (const record of this.records) {
      lines.push('  seq=' + record.sequence + ' event=' + record.event);
      lines.push('    ts=' + record.timestamp);
      lines.push('    hash=' + record.recordHash);
      lines.push('    prev=' + record.previousHash);
    }
    return lines.join('\n');
  }
}
