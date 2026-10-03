import { parseVoiceFinancialInput } from "../src/lib/ai/gemini-client";

async function runTests() {
  console.log("=== Testing TAFINANCE Voice Financial Parser ===");

  const testCases = [
    {
      input: "Gasté 45 mil en comida amigos",
      expectedType: "EXPENSE",
      expectedAmount: 45000,
      expectedCategory: "Alimentación & Restaurantes",
    },
    {
      input: "Recibí pago de nómina",
      expectedType: "INCOME",
      expectedCategory: "Salario & Nómina",
    },
    {
      input: "30 mil de spotify premium",
      expectedType: "EXPENSE",
      expectedAmount: 30000,
      expectedCategory: "Suscripciones & Ocio",
    },
    {
      input: "Pagué 120 mil de luz y agua",
      expectedType: "EXPENSE",
      expectedAmount: 120000,
      expectedCategory: "Servicios Públicos & Hogar",
    },
  ];

  let passed = 0;

  for (const tc of testCases) {
    const result = await parseVoiceFinancialInput(tc.input);
    console.log(`\nInput: "${tc.input}"`);
    console.log(`Result: Type=${result.type}, Amount=${result.amount}, Category=${result.category}`);

    const typeMatches = result.type === tc.expectedType;
    const amountMatches = tc.expectedAmount ? result.amount === tc.expectedAmount : true;
    const categoryMatches = result.category === tc.expectedCategory;

    if (typeMatches && amountMatches && categoryMatches) {
      console.log("✅ PASS");
      passed++;
    } else {
      console.error("❌ FAIL: Expected", tc, "Got", result);
    }
  }

  console.log(`\nTotal: ${passed}/${testCases.length} passed.`);
  if (passed !== testCases.length) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
