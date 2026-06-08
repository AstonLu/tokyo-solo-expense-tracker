import { NextResponse } from "next/server";
import { getAllExpenses, computeBalance } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const expenses = await getAllExpenses();
    const balance = computeBalance(expenses);
    return NextResponse.json({ expenses, balance });
  } catch (err) {
    console.error("Failed to fetch expenses:", err);
    return NextResponse.json(
      { error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}
