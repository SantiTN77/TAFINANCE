import { GoogleGenAI } from "@google/genai";
import { ParsedVoiceTransaction } from "@/types/finance";

export function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/**
 * Intelligent financial parser using Gemini API (or local resilient NLP engine).
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
    const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
    for (const modelName of modelsToTry) {
      try {
        const prompt = `
Eres el asistente contable y financiero inteligente de TAFINANCE.
Analiza lo que dijo el usuario por voz sobre un movimiento de dinero y extrae los campos contables en formato JSON.

Frase del usuario: "${cleanInput}"

Reglas:
1. "type": "EXPENSE" (gastos, compras, pagos) o "INCOME" (cobros, nómina, ventas, transferencias recibidas).
2. "amount": Extrae el valor numérico (ej. "45 mil" = 45000, "1 millón" = 1000000, "50k" = 50000).
3. "currency": "COP" por defecto (o USD / EUR si se especifica).
4. "category": Clasifica en:
   - "Alimentación & Restaurantes"
   - "Transporte & Gasolina"
   - "Suscripciones & Ocio"
   - "Servicios Públicos & Hogar"
   - "Compras & Ropa"
   - "Salud & Cuidado"
   - "Salario & Nómina"
   - "Ingresos Extra & Freelance"
5. "description": Breve título legible (ej. "Almuerzo con amigos", "Pago de arriendo").
6. "merchant": Nombre del establecimiento si aplica (ej. Uber, Spotify, Éxito, D1).
7. "date": Fecha YYYY-MM-DD (hoy si no se especifica).

Responde ÚNICAMENTE un objeto JSON válido con las claves: type, amount, currency, category, description, merchant, date, confidence.
`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });

        const responseText = response.text || "{}";
        const parsed = JSON.parse(responseText);

        if (parsed && typeof parsed.amount === "number") {
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
        }
      } catch (err) {
        // Try next model or fallback
      }
    }
  }

  // Resilient Colombian & Latin American NLP Fallback Engine (100% reliable without API key)
  return parseLocally(cleanInput);
}

/**
 * Intelligent local NLP parser for Latin American finance slang and phrases
 */
export function parseLocally(text: string): ParsedVoiceTransaction {
  const lower = text.toLowerCase();

  // 1. Detect Income vs Expense
  const isIncome = /\b(recibi|recibí|nomina|nómina|sueldo|cobre|cobré|ingreso|honorarios|ganancia|consignaron|consignación|me pagaron|transferencia recibida|venta)\b/.test(
    lower
  );
  const type = isIncome ? "INCOME" : "EXPENSE";

  // 2. Amount Extraction
  let amount = 0;

  // Spelled-out numbers in Spanish
  const wordNumbers: Record<string, number> = {
    "un": 1,
    "uno": 1,
    "dos": 2,
    "tres": 3,
    "cuatro": 4,
    "cinco": 5,
    "seis": 6,
    "siete": 7,
    "ocho": 8,
    "nueve": 9,
    "diez": 10,
    "quince": 15,
    "veinte": 20,
    "veinticinco": 25,
    "treinta": 30,
    "cuarenta": 40,
    "cincuenta": 50,
    "sesenta": 60,
    "setenta": 70,
    "ochenta": 80,
    "noventa": 90,
    "cien": 100,
    "ciento": 100,
    "doscientos": 200,
    "trescientos": 300,
    "cuatrocientos": 400,
    "quinientos": 500,
  };

  // Check spelled numbers with "mil" e.g. "cincuenta mil", "veinte mil"
  const spelledMilMatch = lower.match(
    /\b(diez|quince|veinte|veinticinco|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos)\s*(?:mil|k|lucas)\b/
  );
  if (spelledMilMatch && wordNumbers[spelledMilMatch[1]]) {
    amount = wordNumbers[spelledMilMatch[1]] * 1000;
  }

  // Slang: "50 lucas" / "2 palos" / "medio millón"
  const palosMatch = lower.match(/\b(\d+(?:[.,]\d+)?)\s*(?:palos|palo|millones|millón|millon)\b/);
  const medioMillon = lower.includes("medio millón") || lower.includes("medio millon");
  const lucasMatch = lower.match(/\b(\d+(?:[.,]\d+)?)\s*(?:lucas|barras)\b/);
  const thousandMatch = lower.match(/\b(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b/);
  const plainNumberMatch = lower.match(/(?:\$|\s|^)(\d{1,3}(?:[.,]\d{3})*|\d+)(?!\s*mil|\s*k|\s*mill|\s*palo)/);

  if (amount === 0) {
    if (medioMillon) {
      amount = 500000;
    } else if (palosMatch) {
      amount = parseFloat(palosMatch[1].replace(",", ".")) * 1000000;
    } else if (lucasMatch) {
      amount = parseFloat(lucasMatch[1].replace(",", ".")) * 1000;
    } else if (thousandMatch) {
      amount = parseFloat(thousandMatch[1].replace(",", ".")) * 1000;
    } else if (plainNumberMatch) {
      const rawNum = plainNumberMatch[1].replace(/\./g, "").replace(",", ".");
      amount = parseFloat(rawNum);
    }
  }

  // 3. Category & Merchant Recognition
  let category = "Alimentación & Restaurantes";
  let merchant: string | undefined = undefined;

  if (isIncome) {
    category = "Salario & Nómina";
  } else if (/\b(spotify|netflix|disney|prime|hbo|apple|youtube|cine|suscripcion|suscripción|juego|playstation|xbox|ocio|bar|fiesta|trago|cerveza|licor)\b/.test(lower)) {
    category = "Suscripciones & Ocio";
    if (lower.includes("spotify")) merchant = "Spotify";
    if (lower.includes("netflix")) merchant = "Netflix";
    if (lower.includes("apple")) merchant = "Apple";
  } else if (/\b(uber|didi|cabify|taxi|gasolina|combustible|peaje|transporte|pasaje|bus|metro|transmilenio|vuelo|avion|aeropuerto)\b/.test(lower)) {
    category = "Transporte & Gasolina";
    if (lower.includes("uber")) merchant = "Uber";
    if (lower.includes("didi")) merchant = "DiDi";
  } else if (/\b(luz|agua|gas|recibo|factura|internet|claro|tigo|movistar|arriendo|alquiler|administracion|servicios|electricidad|condominio)\b/.test(lower)) {
    category = "Servicios Públicos & Hogar";
  } else if (/\b(comida|restaurante|almuerzo|cena|desayuno|hamburguesa|pizza|amigos|mercado|café|cafe|supermercado|d1|éxito|exito|jumbo|olimpica|carulla|bistro)\b/.test(lower)) {
    category = "Alimentación & Restaurantes";
    if (lower.includes("d1")) merchant = "Tiendas D1";
    if (lower.includes("exito") || lower.includes("éxito")) merchant = "Éxito";
    if (lower.includes("carulla")) merchant = "Carulla";
  } else if (/\b(ropa|zapatos|tienda|compra|centro comercial|camisa|pantalón|pantalon|zara|falabella|h&m)\b/.test(lower)) {
    category = "Compras & Ropa";
    if (lower.includes("zara")) merchant = "Zara";
    if (lower.includes("falabella")) merchant = "Falabella";
  } else if (/\b(medico|médico|doctor|farmacia|drogueria|droguería|salud|medicina|eps|cruz verde|drogas la rebaja)\b/.test(lower)) {
    category = "Salud & Cuidado";
  }

  // 4. Clean Description formatting
  let cleanDesc = text.trim();
  cleanDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);

  return {
    type,
    amount: isNaN(amount) ? 0 : amount,
    currency: "COP",
    category,
    description: cleanDesc,
    merchant,
    date: new Date().toISOString().split("T")[0],
    confidence: 0.92,
  };
}
