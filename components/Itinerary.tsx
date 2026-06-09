"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tag = "餐飲" | "交通" | "購物" | "住宿" | "門票" | "其他";

interface Stop {
  time: string;
  title: string;
  tags: Tag[];
  notes?: string;
  tasks?: string[];
  rule?: string;
  tbd?: boolean;
  skip?: boolean;
  flag?: boolean;
}

interface Day {
  day: number;
  label: string;
  date: string;
  stops: Stop[];
  priorities: string[];
  skippable: string[];
}

interface NoteGroup {
  title: string;
  items: string[];
}

// ── Itinerary data ─────────────────────────────────────────────────────────────

const TRIP_DAYS: Day[] = [
  {
    day: 1,
    label: "Day 1",
    date: "TBD",
    priorities: [
      "吉祥寺 13:00 交接（硬時限）",
      "新宿相機鏡頭尋價",
      "奢侈品店僅確認庫存，不購入",
      "銀座 / 表參道散步與拍照",
    ],
    skippable: [
      "PATISSERIE TEN&",
      "New Balance",
      "mont-bell",
      "銀座壽司",
      "任何非必要購物",
    ],
    stops: [
      {
        time: "10:00",
        title: "抵達青旅・Check in",
        tags: ["住宿"],
        notes: "若尚未開放入住，先寄放行李。放完包後立刻出發，不在附近逗留。",
      },
      {
        time: "10:20–10:50",
        title: "前往新宿",
        tags: ["交通"],
        notes: "搭電車前往相機店街。",
      },
      {
        time: "11:00–11:40",
        title: "Map Camera / Kitamura Camera 新宿",
        tags: ["購物"],
        tasks: ["尋找 Fujifilm XC 50-230mm F4.5-6.7 OIS II 二手品"],
        rule: "≤ ¥28,000 且品相可接受才購入。¥28,001–¥34,999 不買。¥35,000 以上硬拒（台灣 PChome 全新約 NT$8,360）。此為尋價站，非必買。",
      },
      {
        time: "11:40–12:00",
        title: "決策點：鏡頭",
        tags: ["其他"],
        notes: "符合預算則購入，否則立刻放手。不讓此項耽誤 13:00 吉祥寺接頭。",
      },
      {
        time: "12:00–12:40",
        title: "前往吉祥寺",
        tags: ["交通"],
        notes: "新宿搭 JR 中央線至吉祥寺，約 15 分鐘。",
      },
      {
        time: "13:00",
        title: "吉祥寺站・交接",
        tags: ["其他"],
        tasks: ["在吉祥寺站中央剪票口或北口完成物品交接", "快速完成後立刻離開"],
        flag: true,
      },
      {
        time: "13:05–14:15",
        title: "吉祥寺短暫散步",
        tags: ["其他"],
        tasks: ["井之頭公園", "口琴橫丁", "站前輕食或甜點（選擇性）"],
        notes: "輕鬆 City Walk，非完整觀光行程。",
      },
      {
        time: "14:15–15:15",
        title: "前往銀座 / 日比谷",
        tags: ["交通"],
        notes: "吉祥寺搭車進市區，移動至下午購物區。",
      },
      {
        time: "15:15–15:45",
        title: "PATISSERIE TEN&",
        tags: ["餐飲"],
        notes: "試吃泡芙。時間緊則跳過。",
        skip: true,
      },
      {
        time: "15:45–16:40",
        title: "銀座探店",
        tags: ["購物"],
        tasks: [
          "Dior 銀座：確認女友指定品項與顏色。今日僅確認，不購入。",
          "New Balance 銀座：確認 NB 9060 Summer（選擇性）",
          "mont-bell 銀座 / 京橋：防曬外套、輕量上衣（選擇性）",
        ],
        notes: "三個都是彈性任務，不強求。",
      },
      {
        time: "16:40–17:20",
        title: "前往表參道 / 南青山",
        tags: ["交通"],
      },
      {
        time: "17:20–18:00",
        title: "POLÈNE Tokyo",
        tags: ["購物"],
        tasks: [
          "確認女友指定款式、顏色、庫存",
          "詢問是否可留至明日再購",
        ],
        notes: "今日以確認為主，盡量不購入。",
      },
      {
        time: "18:00–18:50",
        title: "CELINE 表參道",
        tags: ["購物"],
        tasks: [
          "確認女友指定 Celine 品項、顏色、庫存",
        ],
        notes: "Day 1 盡量不購入，明日集中出手。",
      },
      {
        time: "19:00–20:30",
        title: "表參道 / 青山 City Walk＋晚餐",
        tags: ["餐飲", "其他"],
        notes: "輕鬆散步、拍照、晚餐自由選擇，不強求特定餐廳。",
      },
      {
        time: "21:00↑",
        title: "返回青旅",
        tags: ["住宿"],
        tasks: [
          "淋浴、休息",
          "整理 Day 2 購買清單",
          "確認明日哪些奢侈品需出手",
        ],
      },
    ],
  },
  {
    day: 2,
    label: "Day 2",
    date: "TBD",
    priorities: [
      "完成女友奢侈品採購（POLÈNE → CELINE → Dior）",
      "取回行李並安全重新打包",
      "16:45 前出發成田，絕不拖延",
      "個人購物僅在時間充裕時進行",
    ],
    skippable: [
      "相機最終確認（無明確庫存則跳過）",
      "個人選購",
    ],
    stops: [
      {
        time: "08:30",
        title: "起床、整理、收拾行李",
        tags: ["住宿"],
      },
      {
        time: "09:00–09:30",
        title: "Check out / 行李寄放",
        tags: ["住宿"],
        notes: "護照、錢包、信用卡、手機、相機等重要物品隨身攜帶。",
      },
      {
        time: "09:30–10:30",
        title: "青旅附近輕食早餐",
        tags: ["餐飲"],
        notes: "不走太遠，保留體力。",
      },
      {
        time: "10:30–11:30",
        title: "鏡頭最終確認（選擇性）",
        tags: ["購物"],
        notes: "若出現 ≤ ¥28,000 的明確庫存則前往，否則完全跳過。",
        skip: true,
      },
      {
        time: "11:30–12:30",
        title: "午餐",
        tags: ["餐飲"],
        notes: "壽司 / 海鮮 / 炸豬排 / 簡便餐，視位置彈性決定。",
      },
      {
        time: "12:30–13:10",
        title: "前往表參道 / 南青山",
        tags: ["交通"],
        notes: "開始最終奢侈品採購行程。",
      },
      {
        time: "13:10–13:50",
        title: "POLÈNE Tokyo（購入）",
        tags: ["購物"],
        tasks: ["購入女友指定 POLÈNE 品項，保留收據與包裝"],
        notes: "優先度高，庫存風險高且門市選擇少。",
        flag: true,
      },
      {
        time: "13:55–14:35",
        title: "CELINE 表參道（購入）",
        tags: ["購物"],
        tasks: ["購入女友指定 Celine 品項，妥善保留收據與包裝"],
      },
      {
        time: "14:35–15:00",
        title: "前往銀座",
        tags: ["交通"],
      },
      {
        time: "15:00–15:40",
        title: "Dior 銀座（購入）",
        tags: ["購物"],
        tasks: ["購入女友指定 Dior 錢包 / 名片夾，妥善保留收據與包裝"],
      },
      {
        time: "15:40–16:20",
        title: "返回青旅・取行李",
        tags: ["住宿", "交通"],
        tasks: [
          "取回寄放行李",
          "仔細重新打包",
          "奢侈品與相機放手提行李，不托運",
        ],
      },
      {
        time: "16:45",
        title: "出發成田機場",
        tags: ["交通"],
        notes: "從上野搭京成 Skyliner 前往成田第一航廈。此為最晚出發時限，絕不拖延。",
        flag: true,
      },
      {
        time: "17:45–18:15",
        title: "抵達成田機場第一航廈",
        tags: ["交通"],
        notes: "長榮航空 BR195 飛台北，預計 20:40 起飛。",
      },
      {
        time: "18:15–20:10",
        title: "機場流程",
        tags: ["交通"],
        tasks: [
          "辦理登機 / 行李托運",
          "安全檢查",
          "免稅退稅手續（如有）",
          "用餐或輕食",
          "奢侈品與相機隨身攜帶，不托運",
        ],
      },
      {
        time: "20:40",
        title: "起飛 → 台北",
        tags: ["交通"],
      },
    ],
  },
];

// ── Global notes ───────────────────────────────────────────────────────────────

const GLOBAL_NOTES: NoteGroup[] = [
  {
    title: "奢侈品注意",
    items: [
      "購入後不得放置物鎖或公共儲物區，隨身攜帶",
      "收據、包裝與免稅文件妥善保管",
    ],
  },
  {
    title: "信用卡策略",
    items: [
      "奢侈品採購 → 玉山 Uni 卡（額度充足）",
      "小額消費 / Suica 加值 → 國泰 CUBE 卡（啟用「趣旅行」優惠）",
      "刷卡一律選 JPY（日幣），不選 TWD（台幣）",
    ],
  },
  {
    title: "現金策略",
    items: [
      "備用約 ¥10,000 現金即可",
      "能刷卡盡量刷，搭配 Suica",
    ],
  },
  {
    title: "鏡頭購買規則",
    items: [
      "目標：Fujifilm XC 50-230mm F4.5-6.7 OIS II",
      "≤ ¥28,000 且品相可接受 → 購入",
      "¥28,001+ → 不買　¥35,000+ → 硬拒",
    ],
  },
  {
    title: "天氣與穿搭",
    items: [
      "東京約 17–24°C",
      "灰色長褲、深色跑鞋、T 恤、薄外套",
      "不帶腳架",
    ],
  },
];

const OPEN_ITEMS = [
  "青旅地址與最早 Check-in 時間",
  "鏡頭庫存（Day 1 上午確認）",
  "女友奢侈品庫存與可否預留（Day 1 下午確認）",
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
  const dotColor = stop.flag
    ? "bg-[var(--accent)]"
    : stop.tbd
    ? "bg-amber-400"
    : stop.skip
    ? "bg-[var(--muted)]"
    : "bg-[var(--foreground)]";

  const cardStyle = stop.flag
    ? "bg-[var(--surface)] border border-[var(--accent)]/25"
    : stop.tbd
    ? "bg-amber-50/60 border border-amber-100"
    : stop.skip
    ? "bg-[var(--surface-2)] border border-[var(--border)]"
    : "bg-[var(--surface)] border border-[var(--border)]";

  return (
    <div className="flex gap-3">
      {/* Time + vertical line */}
      <div className="flex flex-col items-center w-14 shrink-0">
        <p className="text-[10px] text-[var(--muted)] tabular-nums font-medium leading-tight text-right w-full mt-1 whitespace-nowrap">
          {stop.time}
        </p>
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        {!last && (
          <div className="flex-1 w-px bg-[var(--border)] mt-1.5 min-h-[2rem]" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 mb-3.5 rounded-2xl px-3.5 py-3 ${cardStyle}`}>
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-semibold leading-snug">{stop.title}</p>
          <div className="flex gap-1 shrink-0 mt-0.5">
            {stop.flag && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent)] bg-red-50 px-1.5 py-0.5 rounded-full">
                必辦
              </span>
            )}
            {stop.tbd && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                TBD
              </span>
            )}
            {stop.skip && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded-full">
                可跳過
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        {stop.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {stop.tags.map((t) => (
              <TagChip key={t} tag={t} />
            ))}
          </div>
        )}

        {/* Tasks */}
        {stop.tasks && stop.tasks.length > 0 && (
          <ul className="space-y-1 mb-1.5">
            {stop.tasks.map((task, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--foreground)]">
                <span className="text-[var(--muted)] shrink-0 mt-0.5">·</span>
                <span className="leading-relaxed">{task}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Buying rule */}
        {stop.rule && (
          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-0.5">
              購買規則
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">{stop.rule}</p>
          </div>
        )}

        {/* Notes */}
        {stop.notes && (
          <p className="text-xs text-[var(--muted)] leading-relaxed mt-1">
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
      {/* Day header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="bg-[var(--foreground)] text-white text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide">
          {day.label}
        </span>
        {day.date !== "TBD" ? (
          <span className="text-xs text-[var(--muted)]">{day.date}</span>
        ) : (
          <span className="text-[10px] text-amber-600 font-medium">日期未定</span>
        )}
      </div>

      {/* Priority summary */}
      <div className="mb-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-3.5 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
          今日優先
        </p>
        <ol className="space-y-0.5">
          {day.priorities.map((p, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              <span className="text-[var(--accent)] font-semibold shrink-0 w-3">
                {i + 1}.
              </span>
              <span className="text-[var(--foreground)] leading-relaxed">{p}</span>
            </li>
          ))}
        </ol>
        {day.skippable.length > 0 && (
          <>
            <div className="border-t border-[var(--border)] mt-2 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">
                可跳過
              </p>
              <div className="flex flex-wrap gap-1">
                {day.skippable.map((s, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-[var(--muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded-full"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Timeline */}
      <div>
        {day.stops.map((stop, i) => (
          <StopCard key={i} stop={stop} last={i === day.stops.length - 1} />
        ))}
      </div>
    </section>
  );
}

// ── Global notes ──────────────────────────────────────────────────────────────

function GlobalNotesSection() {
  return (
    <section className="mb-4">
      <h2 className="text-[11px] uppercase tracking-widest text-[var(--muted)] mb-2">
        全程注意事項
      </h2>
      <div className="space-y-2">
        {GLOBAL_NOTES.map((group, i) => (
          <div
            key={i}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item, j) => (
                <li key={j} className="flex items-start gap-1.5 text-xs text-[var(--foreground)]">
                  <span className="text-[var(--accent)] shrink-0 mt-0.5">·</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Itinerary() {
  return (
    <main className="min-h-dvh bg-[var(--background)]">
      <div className="max-w-md mx-auto px-4 pb-24">
        {/* Header */}
        <header className="pt-10 pb-5">
          <h1 className="text-lg font-semibold tracking-tight text-balance">
            東京 2D1N 行程
          </h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {OPEN_ITEMS.length} 項待確認
          </p>
        </header>

        {/* Days */}
        {TRIP_DAYS.map((day) => (
          <DaySection key={day.day} day={day} />
        ))}

        {/* Global notes */}
        <GlobalNotesSection />

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
