# TAFINANCE — guía para agentes

App PWA de finanzas personales (Next 15, React 19, Tailwind, Supabase, Gemini, Web Push). Desplegada en Vercel desde `master` de GitHub; la BD es el proyecto Supabase `qkyflfxnmoymmycwybcw`.

## Comandos

- `pnpm dev` / `pnpm build` / `pnpm test` (cálculo + parser de voz; no tocan Supabase).
- `npx tsc --noEmit` antes de cada commit.
- `pnpm icons` regenera los PNG de la PWA desde `public/icon.svg`.

## Arquitectura (lo que no se ve en el código)

- `src/lib/finance/calc.ts`: lógica pura (saldos, resumen, tarjetas, recordatorios). **Los saldos de cuentas y bolsillos se derivan de las transacciones** (`computeLedger`); `balance` y `current_amount` en BD son solo caché.
  - Ajustes (saldo inicial, "Ajustar saldo") son `ADJUSTMENT`: mueven saldo pero no son ingreso/gasto del mes. Los antiguos (INCOME/EXPENSE sin categoría "Ajuste de saldo"/"Saldo inicial") se detectan con `isAdjustment`.
  - Gasto con `pocket_id`: el bolsillo paga hasta su saldo, el resto sale de la cuenta. Transferencia con bolsillo borrado = no mueve dinero (vuelve a la cuenta).
  - Totales entre vistas: usar `accountTotals` (patrimonio = disponible + bolsillos − deuda). Montos escritos por el usuario: `parseAmount` ("200.000" = 200000).
- `src/lib/storage/finance-store.ts`: store local-first con cola (`outbox`) hacia Supabase. Cualquier cambio de datos pasa por `financeStore`; la UI se suscribe con `useFinance()`. Las cuentas se sincronizan antes que las transacciones (clave foránea).
- Voz: `useVoiceAssistant` (Web Speech → plan B: grabación + `/api/voice/transcribe`). Modelos Gemini baratos (`flash-lite` primero) en `gemini-client.ts` y `receipt-ocr.ts`.
- Tema: tokens CSS en `globals.css` + colores en `tailwind.config.ts` (`bg-app`, `bg-card`, `bg-inset`, `text-white` = tinta del tema, `text-on-accent` = blanco fijo). No uses hex fijos para superficies.
- Push: `public/sw.js`, `PwaProvider`, `/api/push/*`, cron en `vercel.json`.
- Android: TWA (Bubblewrap) en `android/`, ver `android/README.md`. `/.well-known/assetlinks.json` sale de `ANDROID_CERT_SHA256`; CI compila el APK debug.
- Seguridad: `middleware.ts` protege todo salvo rutas públicas; `/api/mcp` exige `MCP_TOKEN`; la biometría se verifica en `/api/auth/biometric*` con cookie firmada.

## Trampas conocidas

- Dos servidores de desarrollo comparten `.next`: el segundo pisa el bundle del primero (y sus variables `NEXT_PUBLIC_*`). Usa uno solo.
- `.env.local` apunta a la **BD real**. Para probar escrituras usa datos claramente marcados y bórralos, o desactiva `NEXT_PUBLIC_SUPABASE_*`.
- Los archivos nuevos en `public/` requieren reiniciar `next dev`.
- Los heredocs largos en el shell fallan con apóstrofes; escribe archivos con la herramienta de edición.
- Las claves/tokens (`GEMINI_API_KEY`, `VAPID_PRIVATE_KEY`, PIN…) las gestiona el dueño en Vercel; no las escribas en código ni en commits.

## Pendiente conocido

- Las tablas de Supabase tienen políticas abiertas; endurecer con `SUPABASE_SERVICE_ROLE_KEY` y rutas de servidor.
