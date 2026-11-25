import { CANON_VERSION, GENESIS_HASH, hashRecord, verifyChain } from './canonical';
import { DustEntry } from './dust';

export interface ChainRecord {
  sequence: number;
  timestamp: string;
  event: string;
  txId: string | null;
  payload: Record<string, unknown>;
  prevHash: string;
  recordHash: string;
}

export interface RejectionEvent {
  txId: string | null;
  code: string;
  reason: string;
  payload?: Record<string, unknown>;
}

export interface AppendOutcome {
  prevHash: string;
  recordHash: string;
  sequence: number;
}

export interface AuditChainOptions {
  clock?: () => string;
  genesis?: string;
}

// Extensão da trilha: usa canonical.hashRecord (C1–C5). A AuditTrail original
// (audit-trail.ts) permanece intacta; esta classe é compatível e adicional.
export class AuditChain {
  private readonly records: ChainRecord[] = [];
  private readonly clock: () => string;
  private readonly genesis: string;

  constructor(options: AuditChainOptions = {}) {
    this.clock = options.clock || function () { return new Date().toISOString(); };
    this.genesis = options.genesis || GENESIS_HASH;
    const genesisPayload = { event: 'AUDIT_CHAIN_GENESIS', cano: CANON_VERSION };
    const createdAt = this.clock();
    this.records.push({
      sequence: 0,
      timestamp: createdAt,
      event: 'AUDIT_CHAIN_GENESIS',
      txId: null,
      payload: genesisPayload,
      prevHash: this.genesis,
      recordHash: hashRecord(this.genesis, genesisPayload)
    });
  }

  append(event: string, payload: Record<string, unknown>, txId: string | null = null): ChainRecord {
    const prev = this.records[this.records.length - 1];
    const timestamp = this.clock();
    const envelope = {
      cano: CANON_VERSION,
      event: event,
      sequence: prev.sequence + 1,
      timestamp: timestamp,
      txId: txId,
      data: payload
    };
    const record: ChainRecord = {
      sequence: prev.sequence + 1,
      timestamp: timestamp,
      event: event,
      txId: txId,
      payload: envelope,
      prevHash: prev.recordHash,
      recordHash: hashRecord(prev.recordHash, envelope)
    };
    this.records.push(record);
    return record;
  }

  appendRejection(rejection: RejectionEvent): ChainRecord {
    return this.append('REJECTION', {
      code: rejection.code,
      reason: rejection.reason,
      meta: rejection.payload || {}
    }, rejection.txId);
  }

  appendDust(dust: DustEntry, txId: string | null = null): ChainRecord {
    return this.append('DUST_ENTRY', {
      dustId: dust.id,
      isin: dust.isin,
      tenant: dust.tenant,
      reason: dust.reason,
      amountCents: dust.amountCents,
      refTxId: dust.refTxId,
      dustHash: dust.recordHash
    }, txId);
  }

  appendCompensation(saga: { txId: string; steps: string[] }): ChainRecord {
    return this.append('SAGA_COMPENSATION', {
      steps: saga.steps
    }, saga.txId);
  }

  head(): { hash: string; index: number } {
    const last = this.records[this.records.length - 1];
    return { hash: last.recordHash, index: last.sequence };
  }

  verify(): boolean {
    return verifyChain(this.records, this.genesis).ok;
  }

  verifyFrom(index: number, genesis: string = this.genesis): { ok: boolean; brokenAt?: number } {
    const from = Math.max(0, index);
    const slice = this.records.slice(from);
    const baseGenesis = from === 0 ? genesis : this.records[from - 1].recordHash;
    return verifyChain(slice, baseGenesis);
  }

  getRecords(): readonly ChainRecord[] {
    return this.records.slice();
  }

  recordsForDate(date: string): readonly ChainRecord[] {
    return this.records.filter(function (r) { return r.timestamp.slice(0, 10) === date; });
  }

  getByTxId(txId: string): readonly ChainRecord[] {
    return this.records.filter(function (r) { return r.txId === txId; });
  }

  auditChainVerifies(): boolean {
    return this.verify();
  }
}
