"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Expense,
  DashboardSummary,
  ExpenseCategory,
  ALL_CATEGORIES,
} from "@/lib/types";
import { getCategoryEmoji } from "@/lib/categories";

interface ApiData {
  transactions: Expense[];
  summary: DashboardSummary;
}

function money(amount: number, currency: string): string {
  const noDecimals = currency === "JPY" || currency === "KRW";
  const n = noDecimals
    ? Math.round(amount).toLocaleString()
    : amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  return `${n} ${currency}`;
}

/* ── State chip ──────────────────────────────────────────────────────────── */

function SourceState({
  loading,
  error,
  count,
}: {
  loading: boolean;
  error: string | null;
  count: number;
}) {
  let dot = "bg-amber-400 animate-pulse";
  let label = "連線 Google Sheets…";
  if (error) {
    dot = "bg-red-400";
    label = "資料來源錯誤";
  } else if (!loading) {
    dot = "bg-emerald-400";
    label = `已連線 · ${count} 筆`;
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </div>
  );
}

/* ── Hero: total spend ───────────────────────────────────────────────────── */

function TotalSpend({ summary }: { summary: DashboardSummary }) {
  const currencies = Object.keys(summary.total_by_currency);
  const extraCurrencies = currencies.filter(
    (c) => c !== summary.primary_currency
  );
  return (
    <section className="bg-[var(--foreground)] text-white rounded-3xl p-6 mb-4">
      <p className="text-[11px] uppercase tracking-widest text-white/50 mb-2">
        總支出
      </p>
      <p className="text-4xl font-bold tabular-nums tracking-tight">
        {money(summary.total_primary, summary.primary_currency)}
      </p>
      <div className="flex items-center justify-between mt-4 text-xs text-white/60">
        <span>{summary.count} 筆交易</span>
        {extraCurrencies.length > 0 && (
          <span>+{extraCurrencies.length} 種其他幣別</span>
        )}
      </div>
    </section>
  );
}

/* ── Spend by currency ───────────────────────────────────────────────────── */

function ByCurrency({ summary }: { summary: DashboardSummary }) {
  const entries = Object.entries(summary.total_by_currency).sort(
    (a, b) => b[1] - a[1]
  );
  if (entries.length <= 1) return null;
  return (
    <section className="mb-4">
      <h2 className="text-[11px] uppercase tracking-widest text-[var(--muted)] mb-2">
        各幣別
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {entries.map(([cur, total]) => (
          <div
            key={cur}
            className="shrink-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3"
          >
            <p className="text-xs text-[var(--muted)]">{cur}</p>
            <p className="text-base font-semibold tabular-nums">
              {money(total, cur)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Spend by category ───────────────────────────────────────────────────── */

function ByCategory({ summary }: { summary: DashboardSummary }) {
  const cats = (ALL_CATEGORIES as ExpenseCategory[]).filter(
    (c) => summary.by_category[c]?.count > 0
  );
  if (cats.length === 0) return null;
  const max = Math.max(...cats.map((c) => summary.by_category[c].total), 1);
  return (
    <section className="mb-4">
      <h2 className="text-[11px] uppercase tracking-widest text-[var(--muted)] mb-2">
        分類（{summary.primary_currency} 估算）
      </h2>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 space-y-3">
        {cats.map((c) => {
          const d = summary.by_category[c];
          return (
            <div key={c}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-1.5">
                  <span>{getCategoryEmoji(c)}</span>
                  <span className="text-[var(--foreground)]">{c}</span>
                  <span className="text-[var(--muted)] text-xs">
                    {d.count}
                  </span>
                </span>
                <span className="font-medium tabular-nums">
                  {money(d.total, summary.primary_currency)}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full"
                  style={{ width: `${(d.total / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Transaction card (expandable) ───────────────────────────────────────── */

function TxCard({ e }: { e: Expense }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-2xl border transition-colors ${
        e.needs_review
          ? "border-amber-200 bg-amber-50/40"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3.5 text-left active:scale-[0.99] transition-transform"
      >
        <span className="text-xl w-7 text-center shrink-0">
          {getCategoryEmoji(e.category)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{e.merchant}</p>
          <p className="text-xs text-[var(--muted)] truncate">
            {e.transaction_date || e.created_at.slice(0, 10)}
            {e.location ? ` · ${e.location}` : ""}
            {e.payment_method ? ` · ${e.payment_method}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums">
            {money(e.amount, e.currency)}
          </p>
          {e.needs_review && (
            <p className="text-[10px] text-amber-600 font-medium">需確認</p>
          )}
        </div>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 pt-0 text-xs text-[var(--muted)] space-y-1.5 border-t border-[var(--border)] mt-0">
          <p className="pt-3 text-[var(--foreground)]">{e.ai_summary}</p>
          {e.original_text_context && (
            <p>
              <span className="text-[var(--muted)]">原始文字：</span>
              {e.original_text_context}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <span>分類：{e.category}</span>
            <span>來源：{e.source === "telegram_photo" ? "照片" : "文字"}</span>
            <span>信心度：{(e.confidence_score * 100).toFixed(0)}%</span>
            {e.image_file_reference && <span>含圖片</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Needs review ────────────────────────────────────────────────────────── */

function NeedsReview({ items }: { items: Expense[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-4">
      <h2 className="text-[11px] uppercase tracking-widest text-amber-600 mb-2">
        待確認 · {items.length}
      </h2>
      <div className="space-y-2">
        {items.map((e) => (
          <TxCard key={e.id} e={e} />
        ))}
      </div>
    </section>
  );
}

/* ── States ──────────────────────────────────────────────────────────────── */

function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
      <p className="text-sm font-medium text-red-700 mb-1">無法載入資料</p>
      <p className="text-xs text-red-600 mb-2">{message}</p>
      <p className="text-xs text-red-500">
        請確認 Google Sheets 環境變數已設定（見 README）。
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-14 text-center">
      <p className="text-3xl mb-3">🧾</p>
      <p className="text-sm font-medium mb-1">還沒有任何記錄</p>
      <p className="text-xs text-[var(--muted)] max-w-56 mx-auto leading-relaxed">
        用 Telegram 傳一張收據或付款截圖，AI 會自動辨識並寫入。
      </p>
    </div>
  );
}

/* ── Root ────────────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/expenses")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok || json.error) throw new Error(json.error || "讀取失敗");
        return json as ApiData;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const reviewItems = useMemo(
    () => data?.transactions.filter((t) => t.needs_review) ?? [],
    [data]
  );
  const confirmedItems = useMemo(
    () => data?.transactions.filter((t) => !t.needs_review) ?? [],
    [data]
  );

  return (
    <main className="min-h-dvh bg-[var(--background)]">
      <div className="max-w-md mx-auto px-4 pb-24">
        <header className="pt-10 pb-5 flex items-end justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">東京記帳 MVP</h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Telegram 自動記帳測試
            </p>
          </div>
          <SourceState
            loading={loading}
            error={error}
            count={data?.summary.count ?? 0}
          />
        </header>

        {loading && (
          <div className="space-y-4">
            <div className="h-32 bg-[var(--surface)] rounded-3xl animate-pulse" />
            <div className="h-24 bg-[var(--surface)] rounded-2xl animate-pulse" />
            <div className="h-40 bg-[var(--surface)] rounded-2xl animate-pulse" />
          </div>
        )}

        {!loading && error && <ErrorState message={error} />}

        {!loading && !error && data && data.summary.count === 0 && (
          <EmptyState />
        )}

        {!loading && !error && data && data.summary.count > 0 && (
          <>
            <TotalSpend summary={data.summary} />
            <ByCurrency summary={data.summary} />
            <ByCategory summary={data.summary} />
            <NeedsReview items={reviewItems} />

            <section>
              <h2 className="text-[11px] uppercase tracking-widest text-[var(--muted)] mb-2">
                最近交易
              </h2>
              <div className="space-y-2">
                {confirmedItems.map((e) => (
                  <TxCard key={e.id} e={e} />
                ))}
                {confirmedItems.length === 0 && (
                  <p className="text-xs text-[var(--muted)] text-center py-4">
                    目前所有記錄都在待確認區。
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
