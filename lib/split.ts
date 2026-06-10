/**
 * Two-person split-expense math for Aston × Amy.
 *
 * Design rule: the AI classifies *who paid* and *who benefits*, but the actual
 * money split is computed here deterministically. Never trust the model's
 * arithmetic — only its labels.
 */
import type { PaidBy, BenefitType } from "./types";

/**
 * Rough USD conversion used only for cross-currency settlement aggregation.
 * Almost every US-trip row is USD; TWD appears for pre-paid items (e.g. the
 * EVA Air ticket). These are estimates, not live FX.
 */
const APPROX_USD: Record<string, number> = {
  USD: 1,
  TWD: 0.032,
  JPY: 0.0067,
  EUR: 1.08,
  GBP: 1.27,
  KRW: 0.00072,
  CNY: 0.14,
  HKD: 0.128,
  SGD: 0.74,
};

export function toUsd(amount: number, currency: string): number {
  const rate = APPROX_USD[(currency || "USD").toUpperCase()] ?? 1;
  return amount * rate;
}

/** Round to cents. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ShareInput {
  amount: number;
  benefit_type: BenefitType;
  /** Used only when benefit_type === "custom". Either side may be provided. */
  aston_share_amount?: number | null;
  amy_share_amount?: number | null;
}

export interface Shares {
  aston_share_amount: number;
  amy_share_amount: number;
}

/**
 * Deterministically split an expense amount into each person's share.
 * When the split is unclear (`unknown`), assume 50/50 per the clarification
 * policy — the payer field, not the split, is what we ask about.
 */
export function computeShares(input: ShareInput): Shares {
  const amount = input.amount > 0 ? input.amount : 0;

  switch (input.benefit_type) {
    case "aston_only":
      return { aston_share_amount: round2(amount), amy_share_amount: 0 };

    case "amy_only":
      return { aston_share_amount: 0, amy_share_amount: round2(amount) };

    case "custom": {
      const a = input.aston_share_amount;
      const m = input.amy_share_amount;
      // If only one side is given, derive the other from the total.
      if (a != null && m == null)
        return { aston_share_amount: round2(a), amy_share_amount: round2(amount - a) };
      if (m != null && a == null)
        return { aston_share_amount: round2(amount - m), amy_share_amount: round2(m) };
      if (a != null && m != null)
        return { aston_share_amount: round2(a), amy_share_amount: round2(m) };
      // No numbers provided for a "custom" split → fall back to 50/50.
      return { aston_share_amount: round2(amount / 2), amy_share_amount: round2(amount / 2) };
    }

    case "shared_50_50":
    case "unknown":
    default: {
      // Derive the second share from the remainder so the two shares always
      // sum exactly to the amount (no sub-cent drift on odd amounts).
      const aston = round2(amount / 2);
      return { aston_share_amount: aston, amy_share_amount: round2(amount - aston) };
    }
  }
}

export interface SettlementRow {
  amount: number;
  currency: string;
  paid_by: PaidBy;
  aston_share_amount: number;
  amy_share_amount: number;
}

export interface Settlement {
  direction: "amy_owes_aston" | "aston_owes_amy" | "settled";
  /** Absolute amount owed, in USD (rough cross-currency estimate). */
  amount_usd: number;
}

/**
 * Net settlement across all expenses, in USD.
 *
 * For each expense the payer fronted the full amount but only owes their own
 * share, so the *other* person owes the payer that other person's share.
 * Positive running balance = Amy owes Aston.
 * Rows with an unknown payer cannot be attributed and are skipped.
 */
export function computeSettlement(rows: SettlementRow[]): Settlement {
  let balanceUsd = 0;
  for (const r of rows) {
    if (r.paid_by === "aston") {
      balanceUsd += toUsd(r.amy_share_amount, r.currency);
    } else if (r.paid_by === "amy") {
      balanceUsd -= toUsd(r.aston_share_amount, r.currency);
    }
  }
  const net = round2(balanceUsd);
  if (Math.abs(net) < 0.01) return { direction: "settled", amount_usd: 0 };
  return net > 0
    ? { direction: "amy_owes_aston", amount_usd: net }
    : { direction: "aston_owes_amy", amount_usd: round2(-net) };
}
