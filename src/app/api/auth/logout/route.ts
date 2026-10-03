import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: "Bóveda bloqueada exitosamente",
  });

  response.cookies.delete("tafinance_session");
  return response;
}
