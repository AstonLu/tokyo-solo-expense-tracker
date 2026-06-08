import { ExpenseCategory } from "./types";

export const CATEGORY_META: Record<
  ExpenseCategory,
  { emoji: string; keywords: string[] }
> = {
  餐飲: {
    emoji: "🍜",
    keywords: [
      "餐",
      "飯",
      "食",
      "吃",
      "喝",
      "cafe",
      "coffee",
      "ramen",
      "sushi",
      "restaurant",
      "convenience",
      "konbini",
      "lawson",
      "family mart",
      "7-eleven",
      "izakaya",
      "居酒屋",
      "ラーメン",
      "寿司",
      "カフェ",
      "コンビニ",
      "定食",
      "うどん",
      "そば",
      "焼肉",
      "lunch",
      "dinner",
      "breakfast",
      "午餐",
      "晚餐",
      "早餐",
    ],
  },
  交通: {
    emoji: "🚇",
    keywords: [
      "交通",
      "電車",
      "車",
      "巴士",
      "計程車",
      "train",
      "subway",
      "metro",
      "bus",
      "taxi",
      "suica",
      "pasmo",
      "jr",
      "yamanote",
      "shinkansen",
      "ic card",
      "鉄道",
      "バス",
      "タクシー",
      "新幹線",
    ],
  },
  購物: {
    emoji: "🛍️",
    keywords: [
      "購物",
      "買",
      "shop",
      "store",
      "mall",
      "donki",
      "don quijote",
      "uniqlo",
      "muji",
      "souvenir",
      "electronics",
      "yodobashi",
      "bic camera",
      "ショッピング",
      "お土産",
      "ドンキ",
      "ユニクロ",
      "無印",
      "藥妝",
      "drugstore",
      "ドラッグ",
    ],
  },
  住宿: {
    emoji: "🏨",
    keywords: [
      "住宿",
      "飯店",
      "旅館",
      "hotel",
      "hostel",
      "inn",
      "ryokan",
      "airbnb",
      "宿",
      "ホテル",
    ],
  },
  門票: {
    emoji: "🎫",
    keywords: [
      "門票",
      "票",
      "入場",
      "museum",
      "temple",
      "shrine",
      "tour",
      "ticket",
      "entrance",
      "attraction",
      "show",
      "game",
      "arcade",
      "博物館",
      "神社",
      "寺",
      "チケット",
      "入場料",
      "遊樂",
    ],
  },
  其他: {
    emoji: "📦",
    keywords: [],
  },
};

export function getCategoryEmoji(category: ExpenseCategory): string {
  return CATEGORY_META[category]?.emoji ?? "📦";
}

export function inferCategory(text: string): ExpenseCategory {
  const lower = text.toLowerCase();
  for (const [category, meta] of Object.entries(CATEGORY_META)) {
    if (category === "其他") continue;
    if (meta.keywords.some((kw) => lower.includes(kw))) {
      return category as ExpenseCategory;
    }
  }
  return "其他";
}
