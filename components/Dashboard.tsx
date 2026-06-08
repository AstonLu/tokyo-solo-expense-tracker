"use client";

import { useEffect, useState, useMemo } from "react";
import { Expense, BalanceSummary, ExpenseCategory, Payer, ALL_CATEGORIES } from "@/lib/types";
import { getCategoryEmoji } from "@/lib/categories";

interface ApiResponse {
  expenses: Expense[];
  balance: BalanceSummary;
  error?: string;
}

type FilterPayer = Payer | "全部";
type SortKey = "date_desc" | "amount_desc";

function fmt(n: number) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function StatusBadge({ status, confidence }: { status: Expense["status"]; confidence: Expense["confidence"] }) {
  if (status === "needs_review" || confidence === "low") {
    return (
      <span className="inline-block w-1 self-stretch bg-amber-400 rounded-full mr-2 shrink-0" />
    );
  }
  return null;
}

function PayerTag({ payer }: { payer: Payer }) {
  const colors =
    payer === "Aston"
      ? "bg-blue-50 text-blue-700"
      : "bg-pink-50 text-pink-700";
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colors} tabular-nums`}>
      {payer}
    </span>
  );
}

function SplitTag({ method }: { method: Expense["split_method"] }) {
  if (method === "平分") return null;
  return (
    <span className="text-[10px] text-[var(--muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
      {method}
    </span>
  );
}

function BalanceCard({ balance }: { balance: BalanceSummary }) {
  const net = balance.net_balance;
  const owesText =
    net > 0.5
      ? `Amy 應付 Aston ${fmt(net)}`
      : net < -0.5
      ? `Aston 應付 Amy ${fmt(Math.abs(net))}`
      : "目前結清 ✓";

  const isSettled = Math.abs(net) < 0.5;

  return (
    <section className="bg-[var(--foreground)] text-white rounded-2xl p-5 mb-4">
      <p className="text-xs text-white/50 mb-1 tracking-wide uppercase">結算</p>
      <p className={`text-xl font-semibold mb-4 ${isSettled ? "text-emerald-400" : "text-white"}`}>
        {owesText}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-[10px] text-white/50 mb-1">Aston 付</p>
          <p className="text-base font-semibold tabular-nums">{fmt(balance.aston_total_paid)}</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-[10px] text-white/50 mb-1">Amy 付</p>
          <p className="text-base font-semibold tabular-nums">{fmt(balance.amy_total_paid)}</p>
        </div>
      </div>
    </section>
  );
}

function CategoryRow({ balance }: { balance: BalanceSummary }) {
  const cats = (ALL_CATEGORIES as ExpenseCategory[]).filter(
    (c) => balance.by_category[c]?.count > 0
  );
  if (cats.length === 0) return null;

  return (
    <section className="mb-4">
      <p className="text-xs text-[var(--muted)] font-medium mb-2 tracking-wide uppercase">分類</p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {cats.map((cat) => (
          <div
            key={cat}
            className="shrink-0 bg-[var(--surface)] rounded-xl px-3 py-2.5 border border-[var(--border)]"
          >
            <p className="text-base leading-none mb-1">{getCategoryEmoji(cat)}</p>
            <p className="text-[11px] text-[var(--muted)]">{cat}</p>
            <p className="text-sm font-semibold tabular-nums">{fmt(balance.by_category[cat].total)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExpenseRow({ expense }: { expense: Expense }) {
  return (
    <div className="flex items-start gap-2 py-3 border-b border-[var(--border)] last:border-0">
      <StatusBadge status={expense.status} confidence={expense.confidence} />
      <div className="text-lg leading-none pt-0.5 w-6 shrink-0 text-center">
        {getCategoryEmoji(expense.category)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)] truncate leading-snug">
          {expense.item_name || expense.merchant}
        </p>
        {expense.item_name && expense.merchant && expense.item_name !== expense.merchant && (
          <p className="text-xs text-[var(--muted)] truncate">{expense.merchant}</p>
        )}
        <div className="flex gap-1.5 mt-1 flex-wrap">
          <PayerTag payer={expense.payer} />
          <SplitTag method={expense.split_method} />
          {expense.date && (
            <span className="text-[10px] text-[var(--muted)]">{expense.date}</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 ml-2">
        <p className="text-sm font-semibold tabular-nums">{fmt(expense.amount)}</p>
        {expense.currency !== "JPY" && (
          <p className="text-[10px] text-[var(--muted)]">{expense.currency}</p>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <p className="text-3xl mb-3">📲</p>
      <p className="text-sm font-medium text-[var(--foreground)] mb-1">還沒有記錄</p>
      <p className="text-xs text-[var(--muted)] max-w-52 mx-auto leading-relaxed">
        傳送消費訊息給 Telegram Bot 開始記帳
      </p>
      <div className="mt-4 bg-[var(--surface)] rounded-xl p-4 text-left max-w-64 mx-auto border border-[var(--border)]">
        <p className="text-[11px] text-[var(--muted)] mb-2">範例格式</p>
        <p className="text-xs font-mono text-[var(--foreground)]">晚餐 2800 Amy付 餐飲</p>
        <p className="text-xs font-mono text-[var(--foreground)]">電車 1200 交通</p>
        <p className="text-xs font-mono text-[var(--foreground)]">ドンキ購物 5400</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterPayer, setFilterPayer] = useState<FilterPayer>("全部");
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "全部">("全部");
  const [sort, setSort] = useState<SortKey>("date_desc");

  useEffect(() => {
    fetch("/api/expenses")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("無法連線到資料來源"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = [...data.expenses];
    if (filterPayer !== "全部") list = list.filter((e) => e.payer === filterPayer);
    if (filterCategory !== "全部") list = list.filter((e) => e.category === filterCategory);
    if (sort === "date_desc") list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else list.sort((a, b) => b.amount - a.amount);
    return list;
  }, [data, filterPayer, filterCategory, sort]);

  const activeCategories = useMemo(
    () =>
      data
        ? (ALL_CATEGORIES as ExpenseCategory[]).filter(
            (c) => data.balance.by_category[c]?.count > 0
          )
        : [],
    [data]
  );

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <div className="max-w-md mx-auto px-4 pb-10">
        {/* Header */}
        <header className="pt-10 pb-6">
          <h1 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
            東京記帳 MVP
          </h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">Telegram 自動記帳測試</p>
        </header>

        {/* Data source state */}
        {loading && (
          <p className="text-xs text-[var(--muted)] mb-4 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            載入中…
          </p>
        )}
        {error && (
          <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-xs text-red-700">連線失敗：{error}</p>
          </div>
        )}
        {!loading && !error && data && (
          <p className="text-xs text-[var(--muted)] mb-4 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {data.balance.count} 筆記錄
          </p>
        )}

        {/* Balance */}
        {data && <BalanceCard balance={data.balance} />}

        {/* Total */}
        {data && data.balance.count > 0 && (
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-xs text-[var(--muted)] uppercase tracking-wide font-medium">總消費</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {fmt(data.balance.total_spend)}
            </p>
          </div>
        )}

        {/* Categories */}
        {data && <CategoryRow balance={data.balance} />}

        {/* Filters */}
        {data && data.balance.count > 0 && (
          <section className="mb-4">
            <div className="flex gap-2 flex-wrap">
              {/* Payer filter */}
              {(["全部", "Aston", "Amy"] as FilterPayer[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPayer(p)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    filterPayer === p
                      ? "bg-[var(--foreground)] text-white border-[var(--foreground)]"
                      : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {p}
                </button>
              ))}
              <div className="w-px bg-[var(--border)] mx-1" />
              {(["全部", ...activeCategories] as (ExpenseCategory | "全部")[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCategory(c)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    filterCategory === c
                      ? "bg-[var(--foreground)] text-white border-[var(--foreground)]"
                      : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {c === "全部" ? "全部" : `${getCategoryEmoji(c)} ${c}`}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setSort("date_desc")}
                className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                  sort === "date_desc"
                    ? "bg-[var(--surface-2)] text-[var(--foreground)] font-medium"
                    : "text-[var(--muted)]"
                }`}
              >
                最新優先
              </button>
              <button
                onClick={() => setSort("amount_desc")}
                className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                  sort === "amount_desc"
                    ? "bg-[var(--surface-2)] text-[var(--foreground)] font-medium"
                    : "text-[var(--muted)]"
                }`}
              >
                金額排序
              </button>
            </div>
          </section>
        )}

        {/* Expense list */}
        {!loading && data && (
          <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-4">
            {filtered.length === 0 && data.balance.count > 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">沒有符合的記錄</p>
            ) : filtered.length === 0 ? (
              <EmptyState />
            ) : (
              filtered.map((e) => <ExpenseRow key={e.id} expense={e} />)
            )}
          </section>
        )}
      </div>
    </div>
  );
}
