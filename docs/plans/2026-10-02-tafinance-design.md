# Documento de Diseño: TAFINANCE

**Fecha**: 2026-10-02  
**Estado**: Aprobado  
**Objetivo**: Aplicación PWA de finanzas y contabilidad personal inteligente, con orbe de voz en tiempo real (Gemini Live), escáner de facturas multimodal, base de datos en Supabase, diseño estilo iOS/MoneAI, y servidor MCP / API REST para Google Spark.

---

## 1. Arquitectura General

TAFINANCE está construida con un stack fullstack moderno, enfocado en rendimiento, tipado estricto y coste $0 (aprovechando los límites gratuitos de Google AI Studio, Supabase y Vercel):

- **Frontend & Backend**: Next.js 15 (App Router, React 19, TypeScript).
- **Gestor de Paquetes**: `pnpm`.
- **Estilos & Animaciones**: Tailwind CSS + Framer Motion (micro-interacciones fluidas tipo iOS).
- **Iconografía**: Lucide React.
- **PWA**: Web App Manifest (`manifest.json`), service worker, iconos adaptativos y soporte offline-first.
- **Base de Datos**: Supabase (PostgreSQL relacional) con Row Level Security (RLS) y soporte SQL nativo para evitar descuadres en los balances.
- **Motor de IA (Google AI Studio)**:
  - `@google/genai` SDK oficial.
  - **Gemini Live API** (`gemini-3.8-live` / `gemini-3.5-transcribe-live`) sobre WebSockets para la experiencia de voz live conversacional.
  - **Gemini Fast Structured Engine** (`gemini-3.5-flash-lite` con Structured Outputs JSON) para procesamiento de voz instantáneo y de coste cero bajo la capa gratuita.
  - **Gemini Vision OCR** (`gemini-3.5-flash-lite`) para digitalización estructurada de recibos y facturas.
- **Integraciones**:
  - API REST en Next.js App Router (`/api/...`).
  - Servidor MCP (Model Context Protocol) en TypeScript (`mcp/`) para conectar con Google Spark y otros agentes.

---

## 2. Experiencia de Usuario (UI/UX) Estilo MoneAI

- **Tema Visual**: Dark mode refinado (`#090D16`, `#0F172A`, `#1E293B`) con acentos esmeralda/índigo y efectos de cristal (*glassmorphism*).
- **El Orbe de Voz Live (Voice Orb)**:
  - Elemento central interactivo con renderizado Canvas / Framer Motion.
  - Reacción dinámica a la amplitud del micrófono y a los estados de la IA:
    - *Inactivo*: Respiración sutil con degradado etéreo.
    - *Escuchando*: Expansión de ondas reactivas a la voz.
    - *Pensando*: Rotación orbital acelerada.
    - *Completado*: Flash esmeralda con tarjeta de transacción prellenada.
- **Vistas**:
  1. **Inicio / Dashboard**: Balance total en vivo, métricas de ingresos vs. gastos, gráfica de tendencia mensual y últimas transacciones.
  2. **Asistente de Voz (Orbe)**: Interfaz a pantalla completa o modal con transcripción en vivo y confirmación de transacciones.
  3. **Escáner de Facturas**: Subida/cámara con análisis visual en tiempo real de ítems y totales.
  4. **Presupuesto y Categorías**: Barras de progreso de presupuesto mensual y desglose por categorías.

---

## 3. Modelo de Datos (PostgreSQL en Supabase)

```sql
-- Cuentas (Bancos, Efectivo, Tarjetas)
create table accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('bank', 'cash', 'credit', 'savings')),
  balance numeric(12,2) default 0.00,
  currency text default 'COP',
  created_at timestamptz default now()
);

-- Categorías
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null,
  color text not null,
  type text not null check (type in ('EXPENSE', 'INCOME'))
);

-- Transacciones
create table transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  type text not null check (type in ('EXPENSE', 'INCOME', 'TRANSFER')),
  amount numeric(12,2) not null,
  currency text default 'COP',
  description text,
  merchant text,
  receipt_url text,
  raw_prompt text,
  date date not null default current_date,
  created_at timestamptz default now()
);

-- Presupuestos Mensuales
create table budgets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade,
  monthly_limit numeric(12,2) not null,
  month text not null
);
```

---

## 4. API REST y Servidor MCP

### Endpoints REST
- `GET /api/transactions` — Listado y filtrado de transacciones.
- `POST /api/transactions` — Creación de transacciones con recálculo de balance.
- `GET /api/summary` — Resumen financiero (balance neto, gastos por categoría, estado del presupuesto).
- `POST /api/voice/parse` — Extracción estructurada desde audio/texto.
- `POST /api/ocr/scan` — Procesamiento multimodal de imágenes de facturas.

### Servidor MCP
Herramientas expuestas para Google Spark:
- `tafinance_create_transaction`: Crea un ingreso o gasto.
- `tafinance_get_balance`: Consulta el balance actual y por cuenta.
- `tafinance_list_transactions`: Obtiene transacciones recientes con filtros.
- `tafinance_get_budget_status`: Devuelve el consumo presupuestario por categoría.

---

## 5. Estrategia de Pruebas y Despliegue

1. **Pruebas de Componentes e Integración**: Verificación de cálculos contables y parsing de IA.
2. **Pruebas E2E en Navegador**: Con `browser_subagent` / Playwright para validar flujo de usuario, responsive en móvil y animaciones.
3. **Control de Versiones en GitHub**: Commits semánticos y preparación de release.
4. **Despliegue en Vercel**: Hosting optimizado con soporte Edge/Serverless.
