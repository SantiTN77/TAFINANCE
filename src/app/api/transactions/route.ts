import { NextRequest, NextResponse } from "next/server";
import { todayStr, monthKey } from "@/lib/finance/calc";
import { storeForRequest } from "@/lib/storage/server-store";

export async function GET(req: NextRequest) {
  const scoped = await storeForRequest();
  if (!scoped.ok) return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  const financeStore = scoped.store;
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    let transactions = await financeStore.getTransactions();

    if (type && (type === "EXPENSE" || type === "INCOME" || type === "TRANSFER")) {
      transactions = transactions.filter((t) => t.type === type);
    }

    return NextResponse.json(transactions.slice(0, limit));
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
    const { type, amount, description, category_id, account_id, merchant, date, raw_prompt } = body;

    if (!type || !amount || !description) {
      return NextResponse.json(
        { error: "type, amount y description son requeridos" },
        { status: 400 }
      );
    }

    const categories = await financeStore.getCategories();
    const accounts = await financeStore.getAccounts();

    const newTx = await financeStore.addTransaction({
      type,
      amount: Number(amount),
      currency: "COP",
      description,
      merchant,
      raw_prompt,
      category_id: category_id || categories[0]?.id,
      account_id: account_id || accounts[0]?.id,
      date: date || todayStr(),
    });

    return NextResponse.json(newTx, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
