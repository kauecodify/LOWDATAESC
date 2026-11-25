import { createHash } from 'node:crypto';

export const CANON_VERSION = 'v1';
export const SEP = '\x00';
export const GENESIS_HASH: string = '0x' + '0'.repeat(64);

export class CanonicalError extends Error {
  constructor(message: string) {
    super('CANONICAL_ERROR: ' + message);
    this.name = 'CanonicalError';
  }
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// C1: chaves em ordem lexicografica ascendente, em TODOS os niveis
// C2: dinheiro/fracao apenas como inteiros (strings reservadas a decimais legiveis)
// C3: UTF-8, sem espacos, sem trailing newline
export function canonicalJson(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'number') {
    if (!Number.isInteger(v)) throw new CanonicalError('float proibido em canonicalJson: ' + String(v));
    return String(v);
  }
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return '[' + v.map(function (item) { return canonicalJson(item); }).join(',') + ']';
  if (typeof v === 'object') {
    const source = v as Record<string, unknown>;
    const keys = Object.keys(source).sort();
    const parts: string[] = [];
    for (const key of keys) {
      if (source[key] === undefined) continue;
      parts.push(JSON.stringify(key) + ':' + canonicalJson(source[key]));
    }
    return '{' + parts.join(',') + '}';
  }
  throw new CanonicalError('tipo nao suportado: ' + typeof v);
}

// C4: separacao prev_hash ‖ payload por byte 0x00 (SEP)
export function hashRecord(prevHash: string, payload: unknown): string {
  if (typeof prevHash !== 'string' || prevHash.length < 64) {
    throw new CanonicalError('prevHash invalido: ' + String(prevHash));
  }
  if (prevHash !== GENESIS_HASH && prevHash.indexOf('0x') !== 0) {
    throw new CanonicalError("prevHash fora do formato '0x' + hex: " + prevHash);
  }
  return sha256Hex(prevHash + SEP + canonicalJson(payload));
}

export interface ChainRecordLike {
  prevHash: string;
  payload: unknown;
  recordHash: string;
}

// C5: GENESIS_HASH como ancora inicial da cadeia
export function verifyChain(records: readonly ChainRecordLike[], genesis: string = GENESIS_HASH): { ok: boolean; brokenAt?: number } {
  let prev = genesis;
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record.prevHash !== prev) return { ok: false, brokenAt: i };
    if (record.recordHash !== hashRecord(record.prevHash, record.payload)) return { ok: false, brokenAt: i };
    prev = record.recordHash;
  }
  return { ok: true };
}
