import { NextRequest, NextResponse } from "next/server";
import { financeStore } from "@/lib/storage/finance-store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || "2026-10";

    const summary = await financeStore.getSummary(month);
    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
