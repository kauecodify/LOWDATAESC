import { sha256Hex } from './canonical';

export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export interface IdempotencyRecord {
  key: string;
  resultHash: string;
  result: unknown;
  createdAt: string;
  expiresAt: string;
}

export class KeyConflict extends Error {
  constructor(key: string) {
    super('IDEMPOTENCY_CONFLICT: chave ' + key + ' ja registrada');
    this.name = 'KeyConflict';
    this.key = key;
  }
  readonly key: string;
}

export interface PutIfAbsentOutcome {
  inserted: boolean;
  existing?: IdempotencyRecord;
}

export interface IdempotencyStore {
  get(key: string, nowIso?: string): IdempotencyRecord | null;
  putIfAbsent(key: string, rec: IdempotencyRecord): PutIfAbsentOutcome;
}

// Implementação em memória para POC. A operação é síncrona e, portanto, atômica
// dentro do event loop. A interface IdempotencyStore permanece obrigatória para backends duráveis.
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  get(key: string, nowIso: string = new Date().toISOString()): IdempotencyRecord | null {
    const rec = this.records.get(key);
    if (!rec) return null;
    if (Date.parse(nowIso) >= Date.parse(rec.expiresAt)) return null;
    return rec;
  }

  putIfAbsent(key: string, rec: IdempotencyRecord): PutIfAbsentOutcome {
    const existing = this.records.get(key);
    if (existing) return { inserted: false, existing: existing };
    this.records.set(key, rec);
    return { inserted: true };
  }
}

export function buildKey(input: {
  tenant: string;
  txId: string;
  nonce: string;
  payload: unknown;
  canonical: (v: unknown) => string;
}): string {
  return sha256Hex(input.tenant + '|' + input.txId + '|' + input.nonce);
}

// Registre em voo para cobertura de chamadas concorrentes com a mesma chave:
// apenas uma promessa é criada; as demais recebem a MESMA promessa.
const inflight = new Map<string, Promise<unknown>>();

export async function withIdempotency<T>(store: IdempotencyStore, key: string, fn: () => Promise<T>): Promise<T> {
  const existing = store.get(key);
  if (existing) return existing.result as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const execution = fn();
  inflight.set(key, execution);
  execution.then(function onOk(res: T) {
    const now = new Date().toISOString();
    store.putIfAbsent(key, {
      key: key,
      resultHash: sha256Hex(JSON.stringify(res)),
      result: res,
      createdAt: now,
      expiresAt: new Date(Date.parse(now) + DEFAULT_IDEMPOTENCY_TTL_MS).toISOString()
    });
    inflight.delete(key);
  }, function onFail() {
    inflight.delete(key);
  });
  return execution;
}

export function clearInflightForTests(): void {
  inflight.clear();
}

export { sha256Hex as idempotencySha256Hex };
