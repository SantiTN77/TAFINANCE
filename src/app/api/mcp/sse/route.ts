import { NextRequest } from "next/server";
import { GET as mcpGet, POST as mcpPost, OPTIONS as mcpOptions } from "../route";

export async function GET(req: NextRequest) {
  return mcpGet(req);
}

export async function POST(req: NextRequest) {
  return mcpPost(req);
}

export async function OPTIONS() {
  return mcpOptions();
}
