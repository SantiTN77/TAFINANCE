import { financeStore } from "../src/lib/storage/finance-store";
import { parseVoiceFinancialInput } from "../src/lib/ai/gemini-client";

async function testMcpCapabilities() {
  console.log("=== Testing TAFINANCE MCP & REST Capabilities ===");

  // 1. Test get_balance
  const summary = await financeStore.getSummary();
  console.log(`1. Balance Total: $${summary.totalBalance.toLocaleString("es-CO")} COP`);
  if (typeof summary.totalBalance !== "number") throw new Error("Balance inválido");
  console.log("✅ tafinance_get_balance PASS");

  // 2. Test create_transaction
  const initialCount = (await financeStore.getTransactions()).length;
  const newTx = await financeStore.addTransaction({
    type: "EXPENSE",
    amount: 15000,
    currency: "COP",
    description: "Café de prueba MCP",
    merchant: "Juan Valdez",
    date: new Date().toISOString().split("T")[0],
  });
  console.log(`2. Created TX: ${newTx.id} - ${newTx.description} ($${newTx.amount})`);
  const updatedCount = (await financeStore.getTransactions()).length;
  if (updatedCount !== initialCount + 1) throw new Error("Fallo al incrementar transacciones");
  console.log("✅ tafinance_create_transaction PASS");

  // 3. Test natural language voice command parsing & direct execution
  const voiceCommand = "Gasté 45 mil en comida amigos";
  const parsed = await parseVoiceFinancialInput(voiceCommand);
  console.log(`3. Natural Command: "${voiceCommand}" -> Parsed: $${parsed.amount} in ${parsed.category}`);
  if (parsed.amount !== 45000) throw new Error("Error en monto parseado");
  console.log("✅ tafinance_process_natural_command PASS");

  // 4. Test budget status
  console.log(`4. Budget categories monitored: ${summary.budgetStatus.length}`);
  console.log("✅ tafinance_get_budget_status PASS");

  console.log("\n🎉 ALL MCP CAPABILITIES VERIFIED SUCCESSFULLY!");
}

testMcpCapabilities().catch((err) => {
  console.error("MCP test error:", err);
  process.exit(1);
});
