"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tag = "餐飲" | "交通" | "購物" | "住宿" | "門票" | "其他";

interface Stop {
  time: string;
  title: string;
  tags: Tag[];
  notes?: string;
  tbd?: boolean;
}

interface Day {
  day: number;
  label: string;
  date: string;
  stops: Stop[];
}

// ── Itinerary data ─────────────────────────────────────────────────────────────
// TBD items are marked — update in place once confirmed.

const TRIP_DAYS: Day[] = [
  {
    day: 1,
    label: "Day 1",
    date: "TBD",
    stops: [
      {
        time: "下午",
        title: "抵達・Check in",
        tags: ["住宿", "交通"],
        notes: "羽田 / 成田 → 市區（利木津巴士 or 電車） — 飯店未定",
        tbd: true,
      },
      {
        time: "18:00",
        title: "澀谷散策",
        tags: ["購物"],
        notes: "スクランブル交差点・109・道玄坂・公園通り",
      },
      {
        time: "20:30",
        title: "晚餐",
        tags: ["餐飲"],
        notes: "澀谷區 — 餐廳未定",
        tbd: true,
      },
    ],
  },
  {
    day: 2,
    label: "Day 2",
    date: "TBD",
    stops: [
      {
        time: "09:00",
        title: "淺草",
        tags: ["門票"],
        notes: "雷門・仲見世通り・浅草寺",
      },
      {
        time: "11:30",
        title: "築地場外市場",
        tags: ["餐飲"],
        notes: "海鮮丼・玉子燒・午餐",
      },
      {
        time: "13:30",
        title: "下午安排",
        tags: ["購物", "其他"],
        notes: "秋葉原 / 新宿 / 上野 — 未定",
        tbd: true,
      },
      {
        time: "17:30",
        title: "往機場",
        tags: ["交通"],
        notes: "回程班機未定 — 預留充足緩衝時間",
        tbd: true,
      },
    ],
  },
];

const REMINDERS = [
  "備妥 IC 卡（Suica / PASMO）— 出發前可先網路購買",
  "現金備用：部分小店不收信用卡",
  "確認飯店 check-in 最早時間",
  "行李可寄放 coin locker 或飯店",
];

const OPEN_ITEMS = [
  "飯店未確認",
  "回程班機時間",
  "Day 2 下午具體安排",
];

// ── Tag chip ──────────────────────────────────────────────────────────────────

const TAG_STYLES: Record<Tag, string> = {
  餐飲: "bg-red-50 text-red-600",
  交通: "bg-sky-50 text-sky-600",
  購物: "bg-purple-50 text-purple-600",
  住宿: "bg-emerald-50 text-emerald-600",
  門票: "bg-orange-50 text-orange-600",
  其他: "bg-[var(--surface-2)] text-[var(--muted)]",
};

function TagChip({ tag }: { tag: Tag }) {
  return (
    <span
      className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TAG_STYLES[tag]}`}
    >
      {tag}
    </span>
  );
}

// ── Stop card ─────────────────────────────────────────────────────────────────

function StopCard({ stop, last }: { stop: Stop; last: boolean }) {
  return (
    <div className="flex gap-3">
      {/* Time + vertical line */}
      <div className="flex flex-col items-center w-12 shrink-0">
        <p className="text-[10px] text-[var(--muted)] tabular-nums font-medium leading-tight text-right w-full mt-1">
          {stop.time}
        </p>
        <div
          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
            stop.tbd ? "bg-amber-400" : "bg-[var(--foreground)]"
          }`}
        />
        {!last && (
          <div className="flex-1 w-px bg-[var(--border)] mt-1.5 min-h-[2rem]" />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 mb-4 rounded-2xl px-3.5 py-3 ${
          stop.tbd
            ? "bg-amber-50/60 border border-amber-100"
            : "bg-[var(--surface)] border border-[var(--border)]"
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-semibold leading-tight">{stop.title}</p>
          {stop.tbd && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
              TBD
            </span>
          )}
        </div>

        {stop.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {stop.tags.map((t) => (
              <TagChip key={t} tag={t} />
            ))}
          </div>
        )}

        {stop.notes && (
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {stop.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Day section ───────────────────────────────────────────────────────────────

function DaySection({ day }: { day: Day }) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-[var(--foreground)] text-white text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide">
          {day.label}
        </span>
        {day.date !== "TBD" ? (
          <span className="text-xs text-[var(--muted)]">{day.date}</span>
        ) : (
          <span className="text-[10px] text-amber-600 font-medium">日期未定</span>
        )}
      </div>

      <div>
        {day.stops.map((stop, i) => (
          <StopCard key={i} stop={stop} last={i === day.stops.length - 1} />
        ))}
      </div>
    </section>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Itinerary() {
  const tbdCount = TRIP_DAYS.flatMap((d) => d.stops).filter((s) => s.tbd).length;

  return (
    <main className="min-h-dvh bg-[var(--background)]">
      <div className="max-w-md mx-auto px-4 pb-24">
        {/* Header */}
        <header className="pt-10 pb-5">
          <h1 className="text-lg font-semibold tracking-tight text-balance">
            東京 2D1N 行程
          </h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {tbdCount > 0 ? `${tbdCount} 項待確認` : "行程已確認"}
          </p>
        </header>

        {/* Days */}
        {TRIP_DAYS.map((day) => (
          <DaySection key={day.day} day={day} />
        ))}

        {/* Reminders */}
        <section className="mb-4">
          <h2 className="text-[11px] uppercase tracking-widest text-[var(--muted)] mb-2">
            提醒事項
          </h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl divide-y divide-[var(--border)]">
            {REMINDERS.map((r, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-2.5">
                <span className="text-[var(--accent)] text-xs mt-0.5 shrink-0">●</span>
                <p className="text-sm leading-relaxed text-[var(--foreground)]">{r}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Open items */}
        {OPEN_ITEMS.length > 0 && (
          <section className="mb-4">
            <h2 className="text-[11px] uppercase tracking-widest text-amber-600 mb-2">
              待確認 · {OPEN_ITEMS.length}
            </h2>
            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl divide-y divide-amber-100">
              {OPEN_ITEMS.map((item, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-2.5">
                  <span className="text-amber-400 text-xs shrink-0">◦</span>
                  <p className="text-sm text-[var(--foreground)]">{item}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
