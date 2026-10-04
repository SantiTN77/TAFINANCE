import { GoogleGenAI } from "@google/genai";
import { ParsedVoiceTransaction } from "@/types/finance";

export function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

// Modelos económicos: primero flash-lite (el más barato), flash solo como respaldo
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export interface ParseOptions {
  /** Nombres de las categorías reales del usuario (la IA elige una de ellas). */
  categories?: string[];
  /** Fecha local YYYY-MM-DD del cliente (para "hoy", "ayer"). */
  today?: string;
  customApiKey?: string;
}

function buildPrompt(cleanInput: string, opts: ParseOptions): string {
  const cats = opts.categories?.length
    ? opts.categories
    : [
        "Alimentación & Restaurantes",
        "Transporte & Gasolina",
        "Suscripciones & Ocio",
        "Servicios Públicos & Hogar",
        "Compras & Ropa",
        "Salud & Cuidado",
        "Salario & Nómina",
        "Ingresos Extra & Freelance",
      ];
  return `
Eres el asistente contable de TAFINANCE (Colombia). Extrae el movimiento de dinero de la frase del usuario.
Hoy es ${opts.today || localToday()}.

Frase del usuario: "${cleanInput}"

Reglas:
1. "type": "EXPENSE" (gastos, compras, pagos) o "INCOME" (cobros, nómina, ventas, dinero recibido).
2. "amount": número en pesos (ej. "45 mil" = 45000, "1.5 millones" = 1500000, "50k" = 50000, "dos lucas" = 2000).
3. "currency": "COP" por defecto (USD / EUR solo si se dice).
4. "category": EXACTAMENTE una de estas: ${cats.map((c) => `"${c}"`).join(", ")}.
5. "description": título breve y legible (ej. "Almuerzo con amigos").
6. "merchant": establecimiento si se menciona (Uber, Spotify, Éxito...), si no omítelo.
7. "date": YYYY-MM-DD (hoy si no se dice; "ayer" = día anterior).
8. "confidence": 0 a 1.

Responde ÚNICAMENTE un JSON válido con: type, amount, currency, category, description, merchant, date, confidence.`;
}

function normalizeParsed(parsed: any, cleanInput: string): ParsedVoiceTransaction | null {
  if (!parsed || typeof parsed !== "object") return null;
  const amount = Number(parsed.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    type: parsed.type === "INCOME" ? "INCOME" : "EXPENSE",
    amount,
    currency: parsed.currency || "COP",
    category: parsed.category || "Alimentación & Restaurantes",
    description: parsed.description || cleanInput,
    merchant: parsed.merchant || undefined,
    date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date || "") ? parsed.date : localToday(),
    confidence: Number(parsed.confidence) || 0.95,
  };
}

/**
 * Parser financiero con Gemini (o motor NLP local resiliente si no hay clave / falla).
 */
export async function parseVoiceFinancialInput(
  rawText: string,
  customApiKeyOrOpts?: string | ParseOptions
): Promise<ParsedVoiceTransaction> {
  const opts: ParseOptions =
    typeof customApiKeyOrOpts === "string" ? { customApiKey: customApiKeyOrOpts } : customApiKeyOrOpts || {};
  const cleanInput = rawText.trim();
  if (!cleanInput) throw new Error("El texto de entrada está vacío");

  const ai = getGeminiClient(opts.customApiKey);
  if (ai) {
    for (const modelName of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: buildPrompt(cleanInput, opts),
          config: { responseMimeType: "application/json", temperature: 0.1 },
        });
        const normalized = normalizeParsed(JSON.parse(response.text || "{}"), cleanInput);
        if (normalized) return normalized;
      } catch (err: any) {
        console.warn(`[TAF][gemini] ${modelName} falló:`, err?.message || err);
      }
    }
  }
  return parseLocally(cleanInput, opts.today);
}

/**
 * Transcribe audio con Gemini y extrae el movimiento en un solo paso.
 * Se usa cuando el reconocimiento de voz del navegador no está disponible.
 */
export async function transcribeAndParse(
  audioBase64: string,
  mimeType: string,
  opts: ParseOptions = {}
): Promise<{ transcript: string; parsed: ParsedVoiceTransaction | null }> {
  const ai = getGeminiClient(opts.customApiKey);
  if (!ai) throw new Error("NO_GEMINI_KEY");

  let lastError: unknown = null;
  for (const modelName of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: audioBase64 } },
              {
                text:
                  `Transcribe literalmente el audio (español de Colombia). ` +
                  `Devuelve un JSON con "transcript" (texto transcrito, "" si no hay voz)` +
                  ` y los campos del movimiento si el audio describe uno: ` +
                  buildPrompt("<transcript>", opts).split("Reglas:")[1],
              },
            ],
          },
        ],
        config: { responseMimeType: "application/json", temperature: 0.1 },
      });
      const json = JSON.parse(response.text || "{}");
      const transcript = String(json.transcript || "").trim();
      if (!transcript) return { transcript: "", parsed: null };
      const parsed = normalizeParsed(json, transcript) || parseLocally(transcript, opts.today);
      return { transcript, parsed };
    } catch (err) {
      lastError = err;
      console.warn(`[TAF][gemini-audio] ${modelName} falló:`, (err as any)?.message || err);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("TRANSCRIBE_FAILED");
}

/* ------------------------------------------------------------------ */
/* Parser local para jerga latinoamericana (100% fiable sin API key)    */
/* ------------------------------------------------------------------ */

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Convierte "treinta y cinco mil quinientos", "dos millones", "un millón doscientos mil" → número. */
export function parseSpanishNumberWords(text: string): number {
  const tokens = strip(text.toLowerCase()).split(/[^a-z0-9.,]+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let seen = false;
  for (const tk of tokens) {
    if (tk === "y") continue;
    if (/^\d+([.,]\d+)?$/.test(tk) && !tk.includes(".") && !tk.includes(",")) {
      current += Number(tk);
      seen = true;
    } else if (tk in UNITS) {
      current += UNITS[tk];
      seen = true;
    } else if (tk === "mil" || tk === "lucas" || tk === "luca") {
      total += (current || 1) * 1000;
      current = 0;
      seen = true;
    } else if (tk === "millon" || tk === "millones" || tk === "palo" || tk === "palos") {
      total += (current || 1) * 1_000_000;
      current = 0;
      seen = true;
    } else if (seen && tk !== "de") {
      break;
    }
  }
  return total + current;
}

export function parseLocally(text: string, today?: string): ParsedVoiceTransaction {
  const lower = text.toLowerCase();
  const plain = strip(lower);

  // 1. Ingreso vs gasto
  const isIncome =
    /\b(recibi|nomina|sueldo|cobre|ingreso|honorarios|ganancia|consignaron|consignacion|me pagaron|me pago|me llego|me depositaron|transferencia recibida|vendi|venta)\b/.test(plain);
  const type = isIncome ? "INCOME" : "EXPENSE";

  // 2. Monto
  let amount = 0;
  const medioMillon = /medio\s+millon/.test(plain);
  const decimalMillon = plain.match(/\b(\d+(?:[.,]\d+)?)\s*(?:millones|millon|palos|palo)\b/);
  const decimalMil = plain.match(/\b(\d+(?:[.,]\d+)?)\s*(?:mil|k|lucas|luca)\b/);

  if (medioMillon) {
    amount = 500000;
  } else if (decimalMillon) {
    amount = parseFloat(decimalMillon[1].replace(",", ".")) * 1_000_000;
  } else if (decimalMil) {
    amount = parseFloat(decimalMil[1].replace(",", ".")) * 1000;
  } else {
    const words = parseSpanishNumberWords(plain);
    if (words >= 100) {
      amount = words;
    } else {
      const plainNumber = plain.match(/(?:\$|\s|^)(\d{1,3}(?:[.,]\d{3})+|\d+)(?!\s*(?:mil|k|mill|palo|luca))/);
      if (plainNumber) amount = parseFloat(plainNumber[1].replace(/[.,](?=\d{3}(?:\D|$))/g, ""));
      else if (words > 0) amount = words;
    }
  }

  // 3. Categoría y comercio
  let category = "Alimentación & Restaurantes";
  let merchant: string | undefined;

  if (isIncome) {
    category = /\b(freelance|honorarios|venta|vendi|extra)\b/.test(plain) ? "Ingresos Extra & Freelance" : "Salario & Nómina";
  } else if (/\b(spotify|netflix|disney|prime|hbo|apple|youtube|cine|suscripcion|juego|playstation|xbox|ocio|bar|fiesta|trago|cerveza|licor|chatgpt|google ai|icloud)\b/.test(plain)) {
    category = "Suscripciones & Ocio";
    for (const m of ["spotify", "netflix", "disney", "apple", "youtube", "hbo", "chatgpt"]) {
      if (plain.includes(m)) merchant = m.charAt(0).toUpperCase() + m.slice(1);
    }
  } else if (/\b(uber|didi|cabify|taxi|gasolina|combustible|peaje|transporte|pasaje|bus|metro|transmilenio|vuelo|avion|aeropuerto|moto|parqueadero)\b/.test(plain)) {
    category = "Transporte & Gasolina";
    if (plain.includes("uber")) merchant = "Uber";
    if (plain.includes("didi")) merchant = "DiDi";
  } else if (/\b(luz|agua|gas|recibo|factura|internet|claro|tigo|movistar|arriendo|alquiler|administracion|servicios|electricidad|condominio)\b/.test(plain)) {
    category = "Servicios Públicos & Hogar";
  } else if (/\b(comida|restaurante|almuerzo|cena|desayuno|hamburguesa|pizza|amigos|mercado|cafe|supermercado|d1|exito|jumbo|olimpica|carulla|bistro|jugo|domicilio|rappi|helado)\b/.test(plain)) {
    category = "Alimentación & Restaurantes";
    if (/\bd1\b/.test(plain)) merchant = "Tiendas D1";
    if (plain.includes("exito")) merchant = "Éxito";
    if (plain.includes("carulla")) merchant = "Carulla";
  } else if (/\b(ropa|zapatos|tienda|compra|centro comercial|camisa|pantalon|zara|falabella|h&m)\b/.test(plain)) {
    category = "Compras & Ropa";
    if (plain.includes("zara")) merchant = "Zara";
    if (plain.includes("falabella")) merchant = "Falabella";
  } else if (/\b(medico|doctor|farmacia|drogueria|salud|medicina|eps|cruz verde|rebaja)\b/.test(plain)) {
    category = "Salud & Cuidado";
  }

  let date = today || localToday();
  if (/\bayer\b/.test(plain)) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() - 1);
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const cleanDesc = text.trim().charAt(0).toUpperCase() + text.trim().slice(1);

  return {
    type,
    amount: Number.isFinite(amount) ? Math.round(amount) : 0,
    currency: "COP",
    category,
    description: cleanDesc,
    merchant,
    date,
    confidence: 0.9,
  };
}
