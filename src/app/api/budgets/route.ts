import { NextRequest, NextResponse } from "next/server";
import { storeForRequest } from "@/lib/storage/server-store";

export async function GET() {
  const scoped = await storeForRequest();
  if (!scoped.ok) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const financeStore = scoped.store;
  try {
    const budgets = await financeStore.getBudgets();
    return NextResponse.json(budgets);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const scoped = await storeForRequest();
  if (!scoped.ok) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const financeStore = scoped.store;
  try {
    const body = await req.json();
    const { categoryId, monthlyLimit, month } = body;

    if (!categoryId || !monthlyLimit || !month) {
      return NextResponse.json(
        { error: "categoryId, monthlyLimit y month son obligatorios" },
        { status: 400 }
      );
    }

    const budget = await financeStore.setBudget(categoryId, Number(monthlyLimit), month);
    return NextResponse.json(budget, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
