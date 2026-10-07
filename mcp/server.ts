import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { storeForMcp } from "../src/lib/storage/server-store";
import { parseVoiceFinancialInput } from "../src/lib/ai/gemini-client";

// Proceso local: los datos son de UN usuario (MCP_USER_ID) con service_role (SUPABASE_SERVICE_ROLE_KEY)
const scoped = storeForMcp();
if (!scoped.ok) {
  console.error(`[tafinance-mcp] ${scoped.error}`);
  process.exit(1);
}
const financeStore = scoped.store;

const server = new Server(
  {
    name: "tafinance-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const TOOLS: Tool[] = [
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
        limit: { type: "number", description: "Cantidad máxima de transacciones a retornar (por defecto 10)" },
        type: { type: "string", enum: ["EXPENSE", "INCOME"], description: "Filtrar por tipo de transacción" },
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
        type: { type: "string", enum: ["EXPENSE", "INCOME"], description: "Tipo de transacción" },
        amount: { type: "number", description: "Monto de la transacción en COP" },
        description: { type: "string", description: "Descripción o motivo del movimiento" },
        merchant: { type: "string", description: "Establecimiento o comercio (opcional)" },
        category_name: { type: "string", description: "Nombre de la categoría (opcional)" },
        date: { type: "string", description: "Fecha en formato YYYY-MM-DD (por defecto hoy)" },
      },
    },
  },
  {
    name: "tafinance_get_budget_status",
    description: "Consulta el estado y consumo de los presupuestos del mes actual.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string", description: "Mes a consultar en formato YYYY-MM (por defecto el actual)" },
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
        command: { type: "string", description: "Frase en lenguaje natural" },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
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
              text: JSON.stringify({ message: "Transacción creada exitosamente", transaction: created }, null, 2),
            },
          ],
        };
      }

      case "tafinance_get_budget_status": {
        const month = (args?.month as string) || "2026-10";
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
                  message: "Comando de voz procesado y registrado con éxito",
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
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error ejecutando herramienta ${name}: ${error.message}` }],
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TAFINANCE MCP Server corriendo en STDIO");
}

run().catch((err) => {
  console.error("Fatal error en MCP Server:", err);
  process.exit(1);
});
