import { createHmac } from 'node:crypto';

export interface Anchor {
  anchorId: string;
  chainHeadHash: string;
  chainHeadIndex: number;
  anchoredAt: string;
  anchorType: 'HSM_SIGNATURE' | 'DOU_PUBLICATION' | 'RFC3161_TIMESTAMP' | 'PUBLIC_CHAIN';
  proof: string;
  signerKeyId?: string;
}

export interface ChainHead {
  hash: string;
  index: number;
}

export interface AnchorBackend {
  publish(head: ChainHead): Promise<Anchor>;
  verify(anchor: Anchor): Promise<boolean>;
}

export class UnanchoredChain extends Error {
  constructor(headHash: string, anchorHash: string | null) {
    super('UNANCHORED_CHAIN: cabeça da cadeia ' + headHash + ' diverge da ancora publicada ' + String(anchorHash));
    this.name = 'UnanchoredChain';
  }
}

export class AnchorBackendError extends Error {
  constructor(message: string) {
    super('ANCHOR_BACKEND_ERROR: ' + message);
    this.name = 'AnchorBackendError';
  }
}

export class InMemoryAnchor implements AnchorBackend {
  private readonly published = new Map<string, Anchor>();

  async publish(head: ChainHead): Promise<Anchor> {
    const anchoredAt = new Date().toISOString();
    const anchorId = 'ANCHOR-' + head.index + '-' + head.hash.slice(0, 12);
    const proof = Buffer.from(this.computeProof(head.hash, head.index + 1, anchoredAt, anchorId), 'utf8').toString('base64');
    const anchor: Anchor = {
      anchorId: anchorId,
      chainHeadHash: head.hash,
      chainHeadIndex: head.index,
      anchoredAt: anchoredAt,
      anchorType: 'PUBLIC_CHAIN',
      proof: proof,
      signerKeyId: 'in-memory-1'
    };
    this.published.set(anchorId, anchor);
    return anchor;
  }

  private computeProof(headHash: string, index: number, anchoredAt: string, anchorId: string): string {
    return headHash + '|' + String(index) + '|' + anchoredAt + '|' + anchorId;
  }

  async verify(anchor: Anchor): Promise<boolean> {
    const stored = this.published.get(anchor.anchorId);
    if (!stored) return false;
    if (stored.chainHeadHash !== anchor.chainHeadHash) return false;
    if (stored.chainHeadIndex !== anchor.chainHeadIndex) return false;
    const recomputed = Buffer.from(this.computeProof(stored.chainHeadHash, stored.chainHeadIndex + 1, stored.anchoredAt, stored.anchorId), 'utf8').toString('base64');
    return recomputed === stored.proof;
  }
}

// Stub de HSM: prova via HMAC-SHA256 com chave fornecida por env (LOWDATAESC_HSM_KEY)
// ou pelo construtor. Substitui somente o backend em ambiente real; sem dependências externas.
export class HsmAnchorStub implements AnchorBackend {
  private readonly secret: string;

  constructor(secretHex?: string) {
    const fromEnv = process.env.LOWDATAESC_HSM_KEY;
    const secret = secretHex || fromEnv;
    if (!secret) throw new AnchorBackendError('chave HSM ausente: defina LOWDATAESC_HSM_KEY ou passe o segredo no construtor');
    this.secret = secret;
  }

  async publish(head: ChainHead): Promise<Anchor> {
    const anchoredAt = new Date().toISOString();
    const anchorId = 'HSM-' + head.index + '-' + head.hash.slice(0, 12);
    const proof = this.computeProof(head.hash, head.index + 1, anchoredAt, anchorId);
    const anchor: Anchor = {
      anchorId: anchorId,
      chainHeadHash: head.hash,
      chainHeadIndex: head.index,
      anchoredAt: anchoredAt,
      anchorType: 'HSM_SIGNATURE',
      proof: proof,
      signerKeyId: 'hsm-stub-k1'
    };
    return anchor;
  }

  private computeProof(headHash: string, index: number, anchoredAt: string, anchorId: string): string {
    return createHmac('sha256', this.secret)
      .update(headHash + '|' + String(index) + '|' + anchoredAt + '|' + anchorId, 'utf8')
      .digest('base64');
  }

  async verify(anchor: Anchor): Promise<boolean> {
    const recomputed = this.computeProof(anchor.chainHeadHash, anchor.chainHeadIndex + 1, anchor.anchoredAt, anchor.anchorId);
    if (recomputed !== anchor.proof) return false;
    if (anchor.signerKeyId !== 'hsm-stub-k1') return false;
    return true;
  }
}

export function assertAnchored(head: ChainHead, anchor: Anchor): void {
  if (anchor.chainHeadHash !== head.hash || anchor.chainHeadIndex !== head.index) {
    throw new UnanchoredChain(head.hash, anchor.chainHeadHash);
  }
}
