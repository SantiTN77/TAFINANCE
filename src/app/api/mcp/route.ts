import { NextRequest, NextResponse } from "next/server";
import { financeStore } from "@/lib/storage/finance-store";
import { parseVoiceFinancialInput } from "@/lib/ai/gemini-client";

// MCP Tools Definition
const MCP_TOOLS = [
  {
    name: "tafinance_get_balance",
    description: "Obtiene el balance total neto, cuentas y resumen mensual de TAFINANCE.",
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
          enum: ["EXPENSE", "INCOME"],
          description: "Filtrar por tipo de transacción",
        },
      },
    },
  },
  {
    name: "tafinance_create_transaction",
    description: "Crea una nueva transacción (gasto o ingreso) en TAFINANCE.",
    inputSchema: {
      type: "object",
      required: ["type", "amount", "description"],
      properties: {
        type: {
          type: "string",
          enum: ["EXPENSE", "INCOME"],
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
    description: "Procesa y registra un comando en lenguaje natural (ej. 'Gasté 45 mil en comida amigos' o 'Recibí pago de nómina').",
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
async function executeTool(name: string, args: Record<string, unknown> = {}) {
  switch (name) {
    case "tafinance_get_balance": {
      const summary = await financeStore.getSummary();
      const accounts = await financeStore.getAccounts();
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
                accounts: accounts.map((a) => ({ name: a.name, balance: a.balance })),
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
      const type = (args?.type as "EXPENSE" | "INCOME") || "EXPENSE";
      const amount = Number(args?.amount);
      const description = String(args?.description || "");
      const merchant = args?.merchant as string | undefined;
      const categoryName = args?.category_name as string | undefined;
      const date = (args?.date as string) || new Date().toISOString().split("T")[0];

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
              { message: "Transacción creada exitosamente en TAFINANCE", transaction: created },
              null,
              2
            ),
          },
        ],
      };
    }

    case "tafinance_get_budget_status": {
      const month = (args?.month as string) || new Date().toISOString().slice(0, 7);
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
        date: parsed.date || new Date().toISOString().split("T")[0],
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
  const acceptHeader = req.headers.get("accept") || "";
  const host = req.headers.get("host") || "tafinance.vercel.app";
  const protocol = req.nextUrl.protocol || "https:";
  const baseUrl = `${protocol}//${host}`;

  const sessionId = Math.random().toString(36).substring(2, 15);
  const postEndpoint = `${baseUrl}/api/mcp?sessionId=${sessionId}`;

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
      version: "1.0.0",
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
              version: "1.0.0",
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

      try {
        const result = await executeTool(toolName, toolArgs);
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

    // Default response for unhandled method
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
  } catch (error: any) {
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
