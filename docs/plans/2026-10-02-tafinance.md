# TAFINANCE Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Construir TAFINANCE, una PWA de finanzas y contabilidad personal inteligente de alta gama (estilo MoneAI/iOS) con Orbe de voz en tiempo real con Gemini Live, escaneo de facturas multimodal, base de datos en Supabase, gráficos reactivos y servidor MCP / API REST para Google Spark.

**Architecture:** Next.js 15 App Router con TypeScript, Tailwind CSS y Framer Motion para una experiencia visual ultra fluida en móviles y escritorio; Supabase PostgreSQL para persistencia contable relacional con RLS; motor de IA dual (Gemini Live WebSocket + Gemini 3.5 Flash-Lite structured output) optimizado para coste $0 en Google AI Studio; y servidor MCP en TypeScript para automatizaciones con Google Spark.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion, Lucide React, `@google/genai`, `@supabase/supabase-js`, `@modelcontextprotocol/sdk`, `pnpm`.

---

### Task 1: Project Initialization & PWA Configuration
**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `public/manifest.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`

**Step 1:** Initialize project with pnpm and install core dependencies (`next`, `react`, `react-dom`, `lucide-react`, `clsx`, `tailwind-merge`, `framer-motion`, `@google/genai`, `@supabase/supabase-js`).
**Step 2:** Configure Tailwind CSS with premium dark theme tokens (`#090D16`, `#121827`, `#1E293B`, emerald, violet, cyan).
**Step 3:** Setup PWA manifest (`manifest.json`) and iOS meta tags in `src/app/layout.tsx`.
**Step 4:** Run build verification: `pnpm build`.
**Step 5:** Commit: `git add . && git commit -m "feat: initialize Next.js 15 PWA with Tailwind and Framer Motion"`.

---

### Task 2: Supabase Schema & Database Integration
**Files:**
- Create: `supabase/migrations/20261002_init_tafinance.sql`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/types/finance.ts`
- Create: `src/lib/storage/mock-store.ts` (almacenamiento reactivo local sincronizado si no hay credenciales activas en dev)

**Step 1:** Define strict TypeScript types for `Account`, `Category`, `Transaction`, `Budget`, `FinancialSummary`.
**Step 2:** Write SQL migration script for Supabase with tables (`accounts`, `categories`, `transactions`, `budgets`), RLS policies, and seed data for initial categories and accounts.
**Step 3:** Implement Supabase browser & server client helpers with graceful offline/local fallback.
**Step 4:** Run test to verify repository methods and math calculations for balances.
**Step 5:** Commit: `git add . && git commit -m "feat: setup Supabase database schema, types, and clients"`.

---

### Task 3: MoneAI-Inspired UI & Interactive Voice Orb
**Files:**
- Create: `src/components/ui/GlassCard.tsx`
- Create: `src/components/voice/VoiceOrb.tsx`
- Create: `src/components/navigation/BottomNav.tsx`
- Create: `src/components/header/Header.tsx`

**Step 1:** Create `GlassCard` with backdrop-filter, border gradients, and iOS blur aesthetic.
**Step 2:** Implement `VoiceOrb` with HTML5 Canvas / Framer Motion supporting 5 states: `idle`, `listening`, `processing`, `success`, `error` with reactive pulsating waveforms.
**Step 3:** Implement mobile bottom navigation bar and sticky header with total net worth balance.
**Step 4:** Verify component rendering and smooth animation transitions.
**Step 5:** Commit: `git add . && git commit -m "feat: build MoneAI style design system and animated Voice Orb"`.

---

### Task 4: AI Voice Engine (Gemini Live & Fast Structured Extractor)
**Files:**
- Create: `src/app/api/voice/parse/route.ts`
- Create: `src/lib/ai/gemini-client.ts`
- Create: `src/hooks/useVoiceAssistant.ts`
- Create: `src/components/voice/VoiceModal.tsx`

**Step 1:** Configure `@google/genai` client using `process.env.GEMINI_API_KEY`.
**Step 2:** Create `/api/voice/parse` with `gemini-3.5-flash-lite` using Structured Output (JSON Schema) to parse natural voice sentences like:
  - "Gasté 45 mil en comida amigos" -> Amount: 45000, Category: Alimentación, Type: EXPENSE.
  - "Recibí pago de nómina" -> Amount: ..., Category: Salario, Type: INCOME.
  - "30 mil de spotify premium" -> Amount: 30000, Category: Suscripciones, Type: EXPENSE.
**Step 3:** Implement `useVoiceAssistant` hook combining Web Speech API (Free Tier 0-latency) with Gemini classification and Gemini Live WebSocket connection ready.
**Step 4:** Create `VoiceModal` with the Orb, live transcription text, and quick transaction confirmation card.
**Step 5:** Run automated tests against voice parsing endpoint with test phrases.
**Step 6:** Commit: `git add . && git commit -m "feat: implement Gemini Live voice engine and structured transaction parser"`.

---

### Task 5: Multimodal Invoice / Receipt OCR Scanner
**Files:**
- Create: `src/app/api/ocr/scan/route.ts`
- Create: `src/components/scanner/ReceiptScannerModal.tsx`
- Create: `src/lib/ai/receipt-ocr.ts`

**Step 1:** Implement `/api/ocr/scan` receiving base64 image and calling `gemini-3.5-flash-lite` with structured schema for merchant, date, total, tax, items list, and suggested category.
**Step 2:** Build `ReceiptScannerModal` with camera capture, drag-and-drop file upload, thumbnail preview, and automated field filling.
**Step 3:** Test OCR parsing endpoint with mock invoice image payload.
**Step 4:** Commit: `git add . && git commit -m "feat: add multimodal invoice and receipt OCR scanner"`.

---

### Task 6: Financial Dashboard, Dynamic Live Charts & Budget Tracking
**Files:**
- Create: `src/components/dashboard/BalanceOverview.tsx`
- Create: `src/components/dashboard/CategoryBreakdownChart.tsx`
- Create: `src/components/dashboard/MonthlyTrendChart.tsx`
- Create: `src/components/dashboard/TransactionList.tsx`
- Create: `src/components/dashboard/NewTransactionModal.tsx`
- Create: `src/components/dashboard/BudgetProgress.tsx`

**Step 1:** Implement dynamic SVG / Canvas charts for monthly expense trends and category donut distribution (live calculations, no mock data).
**Step 2:** Build interactive `TransactionList` with instant search, category filters, and quick delete/edit.
**Step 3:** Implement `BudgetProgress` showing real progress against monthly category limits with warning alerts.
**Step 4:** Implement `NewTransactionModal` for fast manual entry.
**Step 5:** Verify live synchronization: adding a transaction immediately updates the total balance, charts, and budget bars.
**Step 6:** Commit: `git add . && git commit -m "feat: build live financial dashboard, dynamic charts, and budget tracker"`.

---

### Task 7: REST API & MCP Server for Google Spark
**Files:**
- Create: `src/app/api/transactions/route.ts`
- Create: `src/app/api/summary/route.ts`
- Create: `src/app/api/budgets/route.ts`
- Create: `mcp/server.ts`
- Create: `mcp/package.json`
- Create: `mcp/README.md`

**Step 1:** Create clean REST endpoints for standard external integration.
**Step 2:** Implement Model Context Protocol (MCP) server exposing tools:
  - `tafinance_create_transaction`
  - `tafinance_get_balance`
  - `tafinance_list_transactions`
  - `tafinance_get_budget_status`
**Step 3:** Create verification test script executing MCP tool calls locally.
**Step 4:** Commit: `git add . && git commit -m "feat: add REST API and standalone MCP server for Google Spark"`.

---

### Task 8: End-to-End Browser Testing, GitHub & Vercel Readiness
**Files:**
- Create: `tests/e2e.test.ts`
- Create: `README.md`
- Create: `.env.example`
- Create: `vercel.json`

**Step 1:** Run full production build: `pnpm build`.
**Step 2:** Execute visual and functional verification with `browser_subagent` / headless runner.
**Step 3:** Document architecture, setup, environment variables, MCP usage, and Vercel deploy steps in `README.md`.
**Step 4:** Push to GitHub with version tag `v1.0.0` and prepare release.
**Step 5:** Commit: `git add . && git commit -m "docs: finalize documentation, tests, and deployment configuration"`.
