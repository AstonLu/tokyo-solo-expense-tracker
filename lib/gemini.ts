import {
  GoogleGenerativeAI,
  SchemaType,
} from "@google/generative-ai";
import {
  ExtractedExpense,
  ExpenseCategory,
  Payer,
  SplitMethod,
  Confidence,
  ALL_CATEGORIES,
} from "./types";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

const EXTRACTION_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    merchant: { type: SchemaType.STRING, description: "Merchant or place name" },
    item_name: {
      type: SchemaType.STRING,
      description: "What was purchased (in the language used)",
    },
    amount: { type: SchemaType.NUMBER, description: "Numeric amount paid" },
    currency: {
      type: SchemaType.STRING,
      description: "Currency code. Default JPY.",
    },
    category: {
      type: SchemaType.STRING,
      enum: ALL_CATEGORIES,
      description: "Expense category",
    },
    payer: {
      type: SchemaType.STRING,
      enum: ["Aston", "Amy"],
      description:
        "Who paid. Default Aston if not specified.",
    },
    split_method: {
      type: SchemaType.STRING,
      enum: ["平分", "Aston only", "Amy only"],
      description:
        "How to split the expense. Default 平分.",
    },
    confidence: {
      type: SchemaType.STRING,
      enum: ["high", "medium", "low"],
      description: "Confidence level in extraction accuracy",
    },
    date: {
      type: SchemaType.STRING,
      description: "Date in YYYY-MM-DD format if found, else empty string",
      nullable: true,
    },
    notes: {
      type: SchemaType.STRING,
      description: "Any extra notes or unclear parts",
    },
  },
  required: [
    "merchant",
    "item_name",
    "amount",
    "currency",
    "category",
    "payer",
    "split_method",
    "confidence",
  ],
};

const SYSTEM_INSTRUCTION = `You are an expense extraction assistant for a Tokyo travel expense tracker.
Two travelers are on this trip: Aston and Amy.

Rules:
- Default currency is JPY unless stated otherwise
- Default payer is Aston unless the text mentions Amy paid (Amy付/Amy支付/Amy刷)
- Default split_method is 平分 unless:
  - "Aston only" / "Aston自己" / "只有Aston" → split_method: "Aston only"
  - "Amy only" / "Amy自己" / "只有Amy" → split_method: "Amy only"
- For Japanese receipts: look for 合計 (total), amounts with ¥ or 円
- Japanese calendar: 令和7 = 2025, 令和8 = 2026
- If unsure about any field, set confidence: "medium" or "low"
- merchant: store/restaurant name; item_name: what was bought

Category options: 餐飲 交通 購物 住宿 門票 其他`;

export async function extractFromText(text: string): Promise<ExtractedExpense> {
  const ai = getClient();
  const model = ai.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: EXTRACTION_SCHEMA as Parameters<
        typeof ai.getGenerativeModel
      >[0]["generationConfig"] extends infer T
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        : never,
    },
  });

  const result = await model.generateContent(
    `Extract expense from this message: "${text}"`
  );
  const raw = JSON.parse(result.response.text()) as ExtractedExpense & {
    date?: string | null;
  };
  return normalizeExtracted(raw);
}

export async function extractFromImage(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  caption?: string
): Promise<ExtractedExpense> {
  const ai = getClient();
  const model = ai.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: "application/json",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseSchema: EXTRACTION_SCHEMA as any,
    },
  });

  const parts = [
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    },
    {
      text: caption
        ? `Extract expense from this receipt image. User note: ${caption}`
        : "Extract expense from this receipt or payment screenshot.",
    },
  ];

  const result = await model.generateContent(parts);
  const raw = JSON.parse(result.response.text()) as ExtractedExpense & {
    date?: string | null;
  };
  return normalizeExtracted(raw);
}

function normalizeExtracted(raw: Partial<ExtractedExpense> & { date?: string | null }): ExtractedExpense {
  return {
    merchant: raw.merchant || "Unknown",
    item_name: raw.item_name || raw.merchant || "Unknown",
    amount: typeof raw.amount === "number" ? raw.amount : 0,
    currency: (raw.currency || "JPY").toUpperCase(),
    category: (ALL_CATEGORIES.includes(raw.category as ExpenseCategory)
      ? raw.category
      : "其他") as ExpenseCategory,
    payer: (["Aston", "Amy"].includes(raw.payer as string)
      ? raw.payer
      : "Aston") as Payer,
    split_method: (["平分", "Aston only", "Amy only"].includes(
      raw.split_method as string
    )
      ? raw.split_method
      : "平分") as SplitMethod,
    confidence: (["high", "medium", "low"].includes(raw.confidence as string)
      ? raw.confidence
      : "medium") as Confidence,
    date: raw.date || null,
    notes: raw.notes || "",
  };
}
