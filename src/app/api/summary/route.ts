import { NextRequest, NextResponse } from "next/server";
import { financeStore } from "@/lib/storage/server-store";
import { monthKey } from "@/lib/finance/calc";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || monthKey();

    const summary = await financeStore.getSummary(month);
    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
