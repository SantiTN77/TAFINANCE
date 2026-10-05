import { NextRequest, NextResponse } from "next/server";
import { todayStr, monthKey } from "@/lib/finance/calc";
import { checkMcpAuth } from "@/lib/auth/mcp-auth";
import { storeForMcp } from "@/lib/storage/server-store";
import type { FinanceStore } from "@/lib/storage/finance-store";
import { parseVoiceFinancialInput } from "@/lib/ai/gemini-client";

// MCP Tools Definition
const MCP_TOOLS = [
  {
    name: "tafinance_get_balance",
    description: "Obtiene el balance total neto, cuentas bancarias, ahorros y resumen mensual de TAFINANCE.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "tafinance_list_transactions",
    description: "Lista las transacciones recientes de la contabilidad personal.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Cantidad máxima de transacciones a retornar (por defecto 10)",
        },
        type: {
          type: "string",
          enum: ["EXPENSE", "INCOME", "TRANSFER"],
          description: "Filtrar por tipo de transacción",
        },
      },
    },
  },
  {
    name: "tafinance_create_transaction",
    description: "Crea una nueva transacción (gasto, ingreso o transferencia) en TAFINANCE.",
    inputSchema: {
      type: "object",
      required: ["type", "amount", "description"],
      properties: {
        type: {
          type: "string",
          enum: ["EXPENSE", "INCOME", "TRANSFER"],
          description: "Tipo de transacción",
        },
        amount: {
          type: "number",
          description: "Monto de la transacción en COP",
        },
        description: {
          type: "string",
          description: "Descripción o motivo del movimiento",
        },
        merchant: {
          type: "string",
          description: "Establecimiento o comercio (opcional)",
        },
        category_name: {
          type: "string",
          description: "Nombre de la categoría (opcional)",
        },
        date: {
          type: "string",
          description: "Fecha en formato YYYY-MM-DD (por defecto hoy)",
        },
      },
    },
  },
  {
    name: "tafinance_update_transaction",
    description: "Edita un movimiento existente (monto, descripción, fecha, comercio, tipo gasto/ingreso, cuenta o categoría). Los saldos y bolsillos se recalculan solos.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Id del movimiento (ver tafinance_list_transactions)" },
        amount: { type: "number", description: "Nuevo monto en COP" },
        description: { type: "string", description: "Nueva descripción" },
        merchant: { type: "string", description: "Nuevo comercio (vacío para quitarlo)" },
        type: { type: "string", enum: ["EXPENSE", "INCOME"], description: "Cambiar entre gasto e ingreso" },
        date: { type: "string", description: "Nueva fecha YYYY-MM-DD" },
        account_id: { type: "string", description: "Id de la cuenta o tarjeta" },
        category_id: { type: "string", description: "Id de la categoría" },
      },
    },
  },
  {
    name: "tafinance_delete_transaction",
    description: "Elimina un movimiento por id. Si era un aporte a un bolsillo, el aporte se revierte.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Id del movimiento a eliminar" },
      },
    },
  },
  {
    name: "tafinance_list_pockets",
    description: "Lista todos los bolsillos y metas de ahorro del usuario con montos acumulados y objetivos.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "tafinance_create_pocket",
    description: "Crea un nuevo bolsillo o meta de ahorro (ej. Fondo de Emergencia, Vacaciones, Tecnología).",
    inputSchema: {
      type: "object",
      required: ["name", "target_amount"],
      properties: {
        name: {
          type: "string",
          description: "Nombre del bolsillo o meta",
        },
        target_amount: {
          type: "number",
          description: "Meta objetivo a ahorrar",
        },
        category: {
          type: "string",
          description: "Categoría general (Ahorro, Inversión, Metas, Emergencia)",
        },
        color: {
          type: "string",
          description: "Color hexadecimal (opcional, ej. #4cd7f6)",
        },
      },
    },
  },
  {
    name: "tafinance_transfer_to_pocket",
    description: "Transfiere fondos desde una cuenta hacia un bolsillo de ahorro específico.",
    inputSchema: {
      type: "object",
      required: ["pocket_id", "amount"],
      properties: {
        pocket_id: {
          type: "string",
          description: "ID del bolsillo destino",
        },
        amount: {
          type: "number",
          description: "Monto a depositar",
        },
      },
    },
  },
  {
    name: "tafinance_get_budget_status",
    description: "Consulta el estado y consumo de los presupuestos del mes actual.",
    inputSchema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: "Mes a consultar en formato YYYY-MM (por defecto el actual)",
        },
      },
    },
  },
  {
    name: "tafinance_process_natural_command",
    description: "Procesa y registra un comando en lenguaje natural (ej. 'Gasté 45 mil en comida amigos' o 'Ahorré 100 mil en Viajes').",
    inputSchema: {
      type: "object",
      required: ["command"],
      properties: {
        command: {
          type: "string",
          description: "Frase en lenguaje natural para registrar",
        },
      },
    },
  },
];

// Execute MCP Tool
async function executeTool(financeStore: FinanceStore, name: string, args: Record<string, unknown> = {}) {
  switch (name) {
    case "tafinance_get_balance": {
      const summary = await financeStore.getSummary();
      const accounts = await financeStore.getAccounts();
      const pockets = await financeStore.getPockets();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                totalBalance: summary.totalBalance,
                currency: "COP",
                monthlyIncome: summary.monthlyIncome,
                monthlyExpenses: summary.monthlyExpenses,
                savingsRate: `${summary.savingsRate.toFixed(1)}%`,
                accounts: accounts.map((a) => ({ id: a.id, name: a.name, balance: a.balance })),
                pocketsCount: pockets.length,
                totalSavedInPockets: pockets.reduce((acc, p) => acc + Number(p.current_amount), 0),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "tafinance_list_transactions": {
      const limit = (args?.limit as number) || 10;
      const typeFilter = args?.type as string | undefined;
      let txs = await financeStore.getTransactions();
      if (typeFilter) {
        txs = txs.filter((t) => t.type === typeFilter);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(txs.slice(0, limit), null, 2),
          },
        ],
      };
    }

    case "tafinance_create_transaction": {
      const type = (args?.type as "EXPENSE" | "INCOME" | "TRANSFER") || "EXPENSE";
      const amount = Number(args?.amount);
      const description = String(args?.description || "");
      const merchant = args?.merchant as string | undefined;
      const categoryName = args?.category_name as string | undefined;
      const date = (args?.date as string) || todayStr();

      const categories = await financeStore.getCategories();
      const matchedCategory = categoryName
        ? categories.find((c) => c.name.toLowerCase().includes(categoryName.toLowerCase()))
        : categories[0];

      const accounts = await financeStore.getAccounts();

      const created = await financeStore.addTransaction({
        type,
        amount,
        currency: "COP",
        description,
        merchant,
        category_id: matchedCategory?.id,
        account_id: accounts[0]?.id,
        date,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { message: "Transacción registrada exitosamente en TAFINANCE", transaction: created },
              null,
              2
            ),
          },
        ],
      };
    }

    case "tafinance_update_transaction": {
      const { id, ...updates } = args as { id?: string } & Record<string, unknown>;
      if (!id) throw new Error("id es requerido");
      const updated = await financeStore.updateTransaction(String(id), updates);
      if (!updated) throw new Error(`Movimiento ${id} no encontrado`);
      return {
        content: [
          { type: "text", text: JSON.stringify({ message: "Movimiento actualizado", transaction: updated }, null, 2) },
        ],
      };
    }

    case "tafinance_delete_transaction": {
      const id = String(args?.id || "");
      if (!id) throw new Error("id es requerido");
      const ok = await financeStore.deleteTransaction(id);
      if (!ok) throw new Error(`Movimiento ${id} no encontrado`);
      return { content: [{ type: "text", text: JSON.stringify({ message: "Movimiento eliminado", id }, null, 2) }] };
    }

    case "tafinance_list_pockets": {
      const pockets = await financeStore.getPockets();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(pockets, null, 2),
          },
        ],
      };
    }

    case "tafinance_create_pocket": {
      const name = String(args?.name || "");
      const target_amount = Number(args?.target_amount || 0);
      const category = String(args?.category || "Ahorro");
      const color = String(args?.color || "#4cd7f6");

      const pocket = await financeStore.addPocket({
        name,
        target_amount,
        current_amount: 0,
        category,
        color,
        icon: "Wallet",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { message: "Bolsillo de ahorro creado con éxito", pocket },
              null,
              2
            ),
          },
        ],
      };
    }

    case "tafinance_transfer_to_pocket": {
      const pocketId = String(args?.pocket_id || "");
      const amount = Number(args?.amount || 0);

      const success = await financeStore.transferToPocket(pocketId, amount);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success,
                message: success
                  ? `Se transfirieron $${amount} al bolsillo exitosamente`
                  : "No se pudo realizar la transferencia. Verifica el ID del bolsillo.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "tafinance_get_budget_status": {
      const month = (args?.month as string) || monthKey();
      const summary = await financeStore.getSummary(month);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(summary.budgetStatus, null, 2),
          },
        ],
      };
    }

    case "tafinance_process_natural_command": {
      const command = String(args?.command || "");
      const parsed = await parseVoiceFinancialInput(command);

      const categories = await financeStore.getCategories();
      const accounts = await financeStore.getAccounts();

      const matchedCategory = categories.find((c) =>
        c.name.toLowerCase().includes(parsed.category.toLowerCase())
      );

      const created = await financeStore.addTransaction({
        type: parsed.type,
        amount: parsed.amount,
        currency: parsed.currency || "COP",
        description: parsed.description,
        merchant: parsed.merchant,
        raw_prompt: command,
        category_id: matchedCategory?.id || categories[0]?.id,
        account_id: accounts[0]?.id,
        date: parsed.date || todayStr(),
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Comando en lenguaje natural procesado y registrado con éxito",
                parsed,
                createdTransaction: created,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    default:
      throw new Error(`Herramienta no encontrada: ${name}`);
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
};

// OPTIONS for CORS preflights
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// GET: Server-Sent Events (SSE) Endpoint for MCP Handshake
export async function GET(req: NextRequest) {
  const denied = checkMcpAuth(req, CORS_HEADERS);
  if (denied) return denied;
  const acceptHeader = req.headers.get("accept") || "";
  const host = req.headers.get("host") || "tafinance.vercel.app";
  const protocol = req.nextUrl.protocol || "https:";
  const baseUrl = `${protocol}//${host}`;

  const sessionId = Math.random().toString(36).substring(2, 15);
  const qsToken = req.nextUrl.searchParams.get("token");
  const postEndpoint = `${baseUrl}/api/mcp?sessionId=${sessionId}${qsToken ? `&token=${encodeURIComponent(qsToken)}` : ""}`;

  // If client wants SSE (standard MCP protocol)
  if (acceptHeader.includes("text/event-stream") || req.nextUrl.searchParams.has("sse")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial endpoint event according to MCP SSE Spec
        const endpointMessage = `event: endpoint\ndata: ${postEndpoint}\n\n`;
        controller.enqueue(encoder.encode(endpointMessage));

        // Keep connection open with a heartbeat comment
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 15000);
      },
    });

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // If client does a standard GET verification (Google Spark inspector or health check)
  return NextResponse.json(
    {
      name: "tafinance-mcp",
      version: "2.0.0",
      protocolVersion: "2024-11-05",
      status: "active",
      sseEndpoint: `${baseUrl}/api/mcp?sse=true`,
      messageEndpoint: `${baseUrl}/api/mcp`,
      toolsCount: MCP_TOOLS.length,
      tools: MCP_TOOLS,
    },
    { headers: CORS_HEADERS }
  );
}

// POST: JSON-RPC 2.0 Handler for MCP
export async function POST(req: NextRequest) {
  const denied = checkMcpAuth(req, CORS_HEADERS);
  if (denied) return denied;
  try {
    const body = await req.json();
    const { jsonrpc, id, method, params } = body;

    // Handle MCP Methods
    if (method === "initialize") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {
                listChanged: false,
              },
            },
            serverInfo: {
              name: "tafinance",
              version: "2.0.0",
            },
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (method === "notifications/initialized") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (method === "ping") {
      return NextResponse.json({ jsonrpc: "2.0", id, result: {} }, { headers: CORS_HEADERS });
    }

    if (method === "tools/list") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id,
          result: {
            tools: MCP_TOOLS,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      // Los datos son de UN usuario (MCP_USER_ID); sin él, el MCP no toca datos
      const scoped = storeForMcp();
      if (!scoped.ok) {
        return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32000, message: scoped.error } }, { status: scoped.status, headers: CORS_HEADERS });
      }
      try {
        const result = await executeTool(scoped.store, toolName, toolArgs);
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id,
            result,
          },
          { headers: CORS_HEADERS }
        );
      } catch (toolError: any) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id,
            result: {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Error ejecutando ${toolName}: ${toolError.message}`,
                },
              ],
            },
          },
          { headers: CORS_HEADERS }
        );
      }
    }

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      },
      { status: 404, headers: CORS_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32700,
          message: "Parse error",
        },
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
