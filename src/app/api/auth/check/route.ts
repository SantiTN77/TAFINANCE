import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/security";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("tafinance_session")?.value;
  const isValid = await verifySessionToken(token);

  return NextResponse.json({
    authenticated: isValid,
  });
}
