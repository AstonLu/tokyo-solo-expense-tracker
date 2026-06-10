/**
 * Split-math tests. Run with: npm test
 * Uses Node's built-in test runner + native TS type-stripping (no deps).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeShares, computeSettlement, toUsd } from "./split.ts";

test("shared_50_50 splits evenly (Aston paid dinner $60)", () => {
  assert.deepEqual(computeShares({ amount: 60, benefit_type: "shared_50_50" }), {
    aston_share_amount: 30,
    amy_share_amount: 30,
  });
});

test("aston_only gives the whole amount to Aston", () => {
  assert.deepEqual(computeShares({ amount: 100, benefit_type: "aston_only" }), {
    aston_share_amount: 100,
    amy_share_amount: 0,
  });
});

test("amy_only gives the whole amount to Amy (我付 outlet 120, Amy 的)", () => {
  assert.deepEqual(computeShares({ amount: 120, benefit_type: "amy_only" }), {
    aston_share_amount: 0,
    amy_share_amount: 120,
  });
});

test("custom split honors explicit numbers (hotel $300 70/30)", () => {
  assert.deepEqual(
    computeShares({
      amount: 300,
      benefit_type: "custom",
      aston_share_amount: 210,
      amy_share_amount: 90,
    }),
    { aston_share_amount: 210, amy_share_amount: 90 }
  );
});

test("custom split derives the missing side from the total", () => {
  assert.deepEqual(
    computeShares({ amount: 300, benefit_type: "custom", aston_share_amount: 210 }),
    { aston_share_amount: 210, amy_share_amount: 90 }
  );
});

test("unknown benefit defaults to 50/50", () => {
  assert.deepEqual(computeShares({ amount: 50, benefit_type: "unknown" }), {
    aston_share_amount: 25,
    amy_share_amount: 25,
  });
});

test("odd amounts round to cents", () => {
  assert.deepEqual(computeShares({ amount: 25.01, benefit_type: "shared_50_50" }), {
    aston_share_amount: 12.51,
    amy_share_amount: 12.5,
  });
});

test("settlement: Aston paid a shared $60 → Amy owes Aston $30", () => {
  const s = computeSettlement([
    { amount: 60, currency: "USD", paid_by: "aston", aston_share_amount: 30, amy_share_amount: 30 },
  ]);
  assert.equal(s.direction, "amy_owes_aston");
  assert.equal(s.amount_usd, 30);
});

test("settlement: Amy paid a shared $80 → Aston owes Amy $40", () => {
  const s = computeSettlement([
    { amount: 80, currency: "USD", paid_by: "amy", aston_share_amount: 40, amy_share_amount: 40 },
  ]);
  assert.equal(s.direction, "aston_owes_amy");
  assert.equal(s.amount_usd, 40);
});

test("settlement: nets across multiple expenses", () => {
  // Aston paid shared 60 (Amy owes 30); Amy paid shared 80 (Aston owes 40) → net Aston owes Amy 10
  const s = computeSettlement([
    { amount: 60, currency: "USD", paid_by: "aston", aston_share_amount: 30, amy_share_amount: 30 },
    { amount: 80, currency: "USD", paid_by: "amy", aston_share_amount: 40, amy_share_amount: 40 },
  ]);
  assert.equal(s.direction, "aston_owes_amy");
  assert.equal(s.amount_usd, 10);
});

test("settlement: Amy paid but 100% Aston's → Aston owes Amy the full amount", () => {
  const s = computeSettlement([
    { amount: 45, currency: "USD", paid_by: "amy", aston_share_amount: 45, amy_share_amount: 0 },
  ]);
  assert.equal(s.direction, "aston_owes_amy");
  assert.equal(s.amount_usd, 45);
});

test("settlement: unknown payer is skipped, not guessed", () => {
  const s = computeSettlement([
    { amount: 100, currency: "USD", paid_by: "unknown", aston_share_amount: 50, amy_share_amount: 50 },
  ]);
  assert.equal(s.direction, "settled");
  assert.equal(s.amount_usd, 0);
});

test("settlement: empty ledger is settled", () => {
  assert.deepEqual(computeSettlement([]), { direction: "settled", amount_usd: 0 });
});

test("toUsd converts TWD using the rough rate", () => {
  assert.equal(toUsd(1000, "TWD"), 32);
  assert.equal(toUsd(50, "USD"), 50);
});
