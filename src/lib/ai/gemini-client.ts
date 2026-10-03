import { GoogleGenAI } from "@google/genai";
import { ParsedVoiceTransaction } from "@/types/finance";

export function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/**
 * Intelligent financial parser using Gemini 3.5 Flash-Lite (Google AI Studio Free Tier).
 * Falls back to high-accuracy local regex parsing if API key is not configured.
 */
export async function parseVoiceFinancialInput(
  rawText: string,
  customApiKey?: string
): Promise<ParsedVoiceTransaction> {
  const cleanInput = rawText.trim();
  if (!cleanInput) {
    throw new Error("El texto de entrada está vacío");
  }

  const ai = getGeminiClient(customApiKey);

  if (ai) {
    try {
      const prompt = `
Eres el asistente contable y financiero inteligente de TAFINANCE.
Tu objetivo es analizar lo que dijo el usuario por voz sobre un movimiento de dinero y extraer los campos contables estructurados en formato JSON.

Frase del usuario: "${cleanInput}"

Reglas:
1. "type": "EXPENSE" (para gastos, pagos, compras) o "INCOME" (para cobros, pagos recibidos, nómina, transferencias entrantes).
2. "amount": Extrae el valor numérico exacto en números.
   - En español latinoamericano: "45 mil" = 45000, "1 millón" = 1000000, "15k" = 15000, "30 mil" = 30000.
3. "currency": Por defecto "COP" a menos que se mencione explícitamente USD o EUR.
4. "category": Clasifica en una de estas categorías exactas:
   - "Alimentación & Restaurantes"
   - "Transporte & Gasolina"
   - "Suscripciones & Ocio"
   - "Servicios Públicos & Hogar"
   - "Compras & Ropa"
   - "Salud & Cuidado"
   - "Salario & Nómina"
   - "Ingresos Extra & Freelance"
5. "description": Breve título legible de la transacción (ej. "Comida con amigos", "Spotify Premium", "Nómina quincenal").
6. "merchant": Nombre del establecimiento o servicio si se infiere (ej. Spotify, Uber, Éxito, D1, etc.).
7. "date": Fecha en formato YYYY-MM-DD (hoy si no se especifica otra).

Responde ÚNICAMENTE un objeto JSON válido con las claves: type, amount, currency, category, description, merchant, date, confidence.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText);

      return {
        type: parsed.type === "INCOME" ? "INCOME" : "EXPENSE",
        amount: Number(parsed.amount) || 0,
        currency: parsed.currency || "COP",
        category: parsed.category || "Alimentación & Restaurantes",
        description: parsed.description || cleanInput,
        merchant: parsed.merchant || undefined,
        date: parsed.date || new Date().toISOString().split("T")[0],
        confidence: Number(parsed.confidence) || 0.95,
      };
    } catch (error) {
      console.warn("Error invoking Gemini API, using local fallback parser:", error);
    }
  }

  // Fallback: Smart Colombian/Latin-American Financial Natural Language Parser
  return parseLocally(cleanInput);
}

function parseLocally(text: string): ParsedVoiceTransaction {
  const lower = text.toLowerCase();

  // Detect type
  const isIncome = /\b(recibi|recibí|nomina|nómina|sueldo|cobre|cobré|ingreso|honorarios|ganancia)\b/.test(lower);
  const type = isIncome ? "INCOME" : "EXPENSE";

  // Amount extraction
  let amount = 0;
  // Match "1 millon", "2 millones", etc.
  const millionMatch = lower.match(/\b(\d+(?:[.,]\d+)?)\s*(?:millones|millón|millon)\b/);
  // Match "45 mil", "45k", "45mil"
  const thousandMatch = lower.match(/\b(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b/);
  // Match plain numbers
  const plainNumberMatch = lower.match(/(?:\$|\s|^)(\d{1,3}(?:[.,]\d{3})*|\d+)(?!\s*mil|\s*k|\s*mill)/);

  if (millionMatch) {
    amount = parseFloat(millionMatch[1].replace(",", ".")) * 1000000;
  } else if (thousandMatch) {
    amount = parseFloat(thousandMatch[1].replace(",", ".")) * 1000;
  } else if (plainNumberMatch) {
    const rawNum = plainNumberMatch[1].replace(/\./g, "").replace(",", ".");
    amount = parseFloat(rawNum);
  }

  // Detect Category & Merchant with exact word boundaries
  let category = "Alimentación & Restaurantes";
  let merchant: string | undefined = undefined;

  if (isIncome) {
    category = "Salario & Nómina";
  } else if (/\b(spotify|netflix|disney|prime|hbo|apple|youtube|cine|suscripcion|suscripción|juego|ocio|bar|fiesta)\b/.test(lower)) {
    category = "Suscripciones & Ocio";
    if (lower.includes("spotify")) merchant = "Spotify";
    if (lower.includes("netflix")) merchant = "Netflix";
  } else if (/\b(uber|didi|cabify|taxi|gasolina|combustible|peaje|transporte|pasaje|bus|metro|vuelo)\b/.test(lower)) {
    category = "Transporte & Gasolina";
    if (lower.includes("uber")) merchant = "Uber";
    if (lower.includes("didi")) merchant = "DiDi";
  } else if (/\b(luz|agua|recibo|factura|internet|arriendo|alquiler|servicios|electricidad)\b/.test(lower)) {
    category = "Servicios Públicos & Hogar";
  } else if (/\b(comida|restaurante|almuerzo|cena|desayuno|hamburguesa|pizza|amigos|mercado|café|cafe|bistro)\b/.test(lower)) {
    category = "Alimentación & Restaurantes";
  } else if (/\b(ropa|zapatos|tienda|compra|centro comercial|camisa|pantalón|pantalon)\b/.test(lower)) {
    category = "Compras & Ropa";
  } else if (/\b(medico|médico|doctor|farmacia|drogueria|droguería|salud|medicina)\b/.test(lower)) {
    category = "Salud & Cuidado";
  }

  return {
    type,
    amount: isNaN(amount) ? 0 : amount,
    currency: "COP",
    category,
    description: text,
    merchant,
    date: new Date().toISOString().split("T")[0],
    confidence: 0.88,
  };
}
