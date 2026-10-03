# TAFINANCE 💎 — Tu Asistente Personal de Finanzas con IA en Tiempo Real

> Aplicación PWA de contabilidad personal de alta gama (estilo **MoneAI / iOS**) impulsada por **Gemini AI Studio** con **Orbe de Voz Live**, escáner de facturas multimodal, base de datos relacional en **Supabase**, y servidor **MCP / API REST** para automatizaciones con **Google Spark**.

![TAFINANCE Banner](public/icon.svg)

---

## ✨ Características Principales

1. **🎙️ Modo Principal de Voz Live con Orbe Animado**:
   - Orbe 3D reactivo que pulsa y respira según el volumen de tu micrófono.
   - Procesamiento en lenguaje natural:
     - *"Gasté 45 mil en comida amigos"* ➔ Extrae monto ($45.000 COP), categoría (*Alimentación & Restaurantes*), tipo (*GASTO*).
     - *"Recibí pago de nómina"* ➔ Extrae ingreso, categoría (*Salario & Nómina*).
     - *"30 mil de Spotify premium"* ➔ Registra $30.000 en *Suscripciones & Ocio*.
   - **Coste $0 Garantizado**: Integrado con la capa gratuita de Google AI Studio (`gemini-3.5-flash-lite` y Web Speech API nativa).

2. **🧾 Escáner OCR Multimodal de Facturas y Recibos**:
   - Sube o toma una foto desde la cámara de tu factura física o digital.
   - Detección visual con Gemini Multimodal: extrae comercio, fecha, desglose de ítems, IVA y total a pagar.

3. **📊 Estadísticas y Gráficos Live (Cero Mocks)**:
   - Gráfico de curva SVG interactiva con evolución del patrimonio neto.
   - Gráfico de dona de distribución de gastos por categoría en tiempo real.
   - Barras de control de presupuestos mensuales con alertas visuales de consumo.

4. **📱 Progressive Web App (PWA) Móvil**:
   - Instalable en iPhone (iOS Safari "Añadir a pantalla de inicio") y Android.
   - Modo oscuro refinado con glassmorphism, tipografía SF Pro y animaciones fluidas con Framer Motion.

5. **⚡ Conexión con Supabase & Modo Local Offline**:
   - Tablas contables ACID en PostgreSQL: `accounts`, `categories`, `transactions`, `budgets`.
   - Motor de persistencia local-first integrado para funcionar sin conexión o sin configurar credenciales de inmediato.

6. **🤖 Servidor MCP & API REST para Google Spark**:
   - Servidor **Model Context Protocol (MCP)** en `mcp/server.ts` con herramientas (`tafinance_create_transaction`, `tafinance_get_balance`, `tafinance_list_transactions`, `tafinance_get_budget_status`, `tafinance_process_natural_command`).
   - Endpoints REST `/api/transactions`, `/api/summary`, `/api/budgets`, `/api/voice/parse`, `/api/ocr/scan`.

---

## 🛠️ Stack Tecnológico

- **Framework**: Next.js 15 (App Router, React 19, TypeScript)
- **Gestor de Paquetes**: `pnpm` (estrictamente)
- **Estilos**: Tailwind CSS + Framer Motion
- **Iconografía**: Lucide React
- **IA**: `@google/genai` (Google AI Studio Gemini 3.5 Flash-Lite & Gemini 3.8 Live)
- **Base de Datos**: Supabase (PostgreSQL con RLS)
- **MCP**: `@modelcontextprotocol/sdk`
- **Hosting**: Vercel

---

## 🚀 Instalación y Puesta en Marcha

### 1. Clonar el repositorio
```bash
git clone https://github.com/SantiTN77/TAFINANCE.git
cd TAFINANCE
```

### 2. Instalar dependencias con pnpm
```bash
pnpm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env.local` basado en `.env.example`:
```bash
cp .env.example .env.local
```

Configura tus claves:
```env
# Google AI Studio (Gratuito)
GEMINI_API_KEY=tu_api_key_de_ai_studio

# Supabase (Opcional - La app incluye almacenamiento local reactivo)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
```

### 4. Ejecutar en Desarrollo
```bash
pnpm dev
```
Abre en tu navegador: [http://localhost:3000](http://localhost:3000)

---

## 🤖 Servidor MCP para Google Spark

Para conectar TAFINANCE a Google Spark o cualquier orquestador compatible con MCP:

```bash
pnpm mcp
```

Herramientas disponibles:
- `tafinance_get_balance`: Consulta el balance total y saldo de cada cuenta.
- `tafinance_create_transaction`: Registra ingresos o gastos programáticamente.
- `tafinance_list_transactions`: Filtra transacciones recientes.
- `tafinance_get_budget_status`: Consulta el presupuesto mensual disponible.
- `tafinance_process_natural_command`: Ejecuta frases de voz como *"Gasté 45 mil en comida amigos"*.

---

## 🌐 Despliegue en Vercel

El proyecto está 100% optimizado para Vercel:

1. Ve a [vercel.com](https://vercel.com) e importa el repositorio `SantiTN77/TAFINANCE`.
2. Configura las variables de entorno (`GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. Haz clic en **Deploy**. ¡Listo en menos de 2 minutos!

---

## 📄 Licencia

MIT © 2026 Daniel Tafur (SantiTN77)
