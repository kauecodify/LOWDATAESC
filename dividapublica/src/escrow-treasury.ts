import { DebtReductionOrder, TreasuryBond } from './types';
import { formatBRL, formatFraction } from './split-engine';

// Escala inteira de frações: 1.000.000 micro-frações por unidade de título.
export const FRACTION_SCALE = 1000000;

export class EscrowError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super('[ESCROW] ' + code + ': ' + message);
    this.name = 'EscrowError';
    this.code = code;
  }
}

export type EscrowLedgerEntry = {
  timestamp: string;
  account: string;
  debit: number;
  credit: number;
  memo: string;
};

// Camada 6: custódia segregada. Nenhum fluxo é liberado sem lançamento no razão escrow.
export class EscrowTreasury {
  private balances = new Map<string, number>();
  private labels = new Map<string, string>();
  private ledger: EscrowLedgerEntry[] = [];
  private bonds = new Map<string, TreasuryBond>();
  private debtStockByIsin = new Map<string, number>();
  private orders: DebtReductionOrder[] = [];

  openEscrowAccount(account: string, label: string, initialBalanceCents: number = 0): void {
    if (!account) throw new EscrowError('ESCROW_BALANCE', 'conta escrow obrigatoria');
    if (this.balances.has(account)) throw new EscrowError('ESCROW_BALANCE', 'conta escrow ja aberta: ' + account);
    if (!Number.isInteger(initialBalanceCents) || initialBalanceCents < 0) throw new EscrowError('ESCROW_BALANCE', 'saldo inicial invalido');
    this.balances.set(account, initialBalanceCents);
    this.labels.set(account, label);
  }

  getBalance(account: string): number {
    const b = this.balances.get(account);
    if (b === undefined) throw new EscrowError('ESCROW_BALANCE', 'conta escrow inexistente: ' + account);
    return b;
  }

  labelOf(account: string): string {
    return this.labels.get(account) || account;
  }

  private requireAccount(account: string): void {
    if (!this.balances.has(account)) throw new EscrowError('ESCROW_BALANCE', 'conta escrow inexistente: ' + account);
  }

  deposit(account: string, amountCents: number, memo: string): number {
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new EscrowError('ESCROW_BALANCE', 'deposito deve ser inteiro positivo em centavos');
    this.requireAccount(account);
    this.balances.set(account, this.getBalance(account) + amountCents);
    this.ledger.push({ timestamp: new Date().toISOString(), account: account, debit: 0, credit: amountCents, memo: memo });
    return this.getBalance(account);
  }

  debit(account: string, amountCents: number, memo: string): number {
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new EscrowError('ESCROW_BALANCE', 'debito deve ser inteiro positivo em centavos');
    const balance = this.getBalance(account);
    if (balance < amountCents) {
      throw new EscrowError('ESCROW_BALANCE', 'saldo insuficiente em ' + account + ': ' + formatBRL(balance) + ' < ' + formatBRL(amountCents));
    }
    this.balances.set(account, balance - amountCents);
    this.ledger.push({ timestamp: new Date().toISOString(), account: account, debit: amountCents, credit: 0, memo: memo });
    return this.getBalance(account);
  }

  registerBond(bond: TreasuryBond, debtStockFracPico: number): void {
    if (!/^[A-Z0-9]{12}$/.test(bond.isin)) throw new EscrowError('BOND_STOCK', 'ISIN invalido: ' + bond.isin);
    if (!Number.isInteger(bond.puCents) || bond.puCents <= 0) throw new EscrowError('BOND_STOCK', 'PU do titulo deve ser inteiro positivo em centavos');
    if (!Number.isInteger(debtStockFracPico) || debtStockFracPico < 0) throw new EscrowError('BOND_STOCK', 'estoque de divida invalido');
    this.bonds.set(bond.isin, bond);
    this.debtStockByIsin.set(bond.isin, debtStockFracPico);
  }

  getBond(isin: string): TreasuryBond {
    const bond = this.bonds.get(isin);
    if (!bond) throw new EscrowError('BOND_STOCK', 'titulo nao custodiado: ' + isin);
    return bond;
  }

  getDebtStockFracPico(isin: string): number {
    const stock = this.debtStockByIsin.get(isin);
    if (stock === undefined) throw new EscrowError('BOND_STOCK', 'estoque de divida inexistente para ' + isin);
    return stock;
  }

  getOrders(): DebtReductionOrder[] {
    return this.orders.slice();
  }

  // Liquidação D-0: varre o escrow de amortização e converte o saldo em baixa
  // de frações do título público, reduzindo o estoque da dívida em tempo real.
  amortizeDebt(escrowAccount: string, isin: string): DebtReductionOrder {
    const amountCents = this.getBalance(escrowAccount);
    if (amountCents <= 0) throw new EscrowError('ESCROW_BALANCE', 'fundo escrow vazio: ' + escrowAccount);
    const bond = this.getBond(isin);

    const productCentsPico = amountCents * FRACTION_SCALE;
    if (productCentsPico % bond.puCents !== 0) {
      throw new EscrowError('ESCROW_PRECISION', 'valor escrow ' + formatBRL(amountCents) + ' nao converte exatamente em frações do PU ' + formatBRL(bond.puCents));
    }
    const fractionPico = Math.floor(productCentsPico / bond.puCents);
    if (fractionPico <= 0) throw new EscrowError('ESCROW_PRECISION', 'fração resultante igual a zero');

    const debtBefore = this.getDebtStockFracPico(isin);
    if (debtBefore < fractionPico) throw new EscrowError('BOND_STOCK', 'estoque do titulo ' + isin + ' insuficiente para baixa de ' + formatFraction(fractionPico));

    this.debit(escrowAccount, amountCents, "liquidacao escrow de amortizacao -> " + isin);
    this.debtStockByIsin.set(isin, debtBefore - fractionPico);

    const order: DebtReductionOrder = {
      orderType: 'AMORTIZACAO_PARCIAL',
      isin: isin,
      amountCents: amountCents,
      puCents: bond.puCents,
      fractionPico: fractionPico,
      fractionDecimal: formatFraction(fractionPico),
      debtBeforeFracPico: debtBefore,
      debtRemainingFracPico: this.getDebtStockFracPico(isin),
      escrowAccount: escrowAccount
    };
    this.orders.push(order);
    return order;
  }

  summarizeBalances(): string {
    const lines: string[] = [];
    const accounts: string[] = [];
    this.balances.forEach(function (_v, k) { accounts.push(k); });
    accounts.sort();
    for (const account of accounts) {
      lines.push('  - ' + account + ' (' + this.labelOf(account) + '): ' + formatBRL(this.getBalance(account)));
    }
    return lines.join('\n');
  }
}
