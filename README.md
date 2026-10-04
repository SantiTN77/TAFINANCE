# TAFINANCE

App PWA de finanzas personales: registra gastos con voz, escanea facturas, organiza bolsillos y tarjetas de crédito, y recibe avisos de pago aunque la app esté cerrada.

## Características

- **Voz**: dicta «gasté 45 mil en almuerzo». Usa el reconocimiento del navegador y, si no está disponible o falla, graba el audio y lo transcribe con Gemini (requiere `GEMINI_API_KEY`). Siempre hay un campo de texto como alternativa.
- **Escáner de facturas** (Gemini multimodal): comercio, total e ítems.
- **Estadísticas en tiempo real**: patrimonio, gráfica de evolución, distribución por categoría, presupuestos y **cierre de mes** navegable (con opción de apartar el excedente en un bolsillo).
- **Cuentas y tarjetas**: día de corte y de pago, extracto cerrado vs. por facturar, pago de tarjeta y estimación de la rentabilidad de los días de financiación.
- **Recordatorios y push**: corte, vencimiento (N días antes) y compromisos recurrentes, con notificaciones Web Push aunque la app esté cerrada.
- **PWA**: instalable, funciona sin conexión (los cambios se sincronizan al volver la red), temas claro / oscuro / OLED.
- **Depuración**: consola de logs en vivo con `?debug=1` (o Ajustes → Depuración); `window.__taf` en DevTools.

## Acceso

La landing es pública y no expone ningún acceso. La bóveda se abre desde el logo con una secuencia secreta (7 toques → mantener 3 s → 10 toques) y luego PIN o huella.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion · Supabase · Google Gemini (`@google/genai`) · Web Push (`web-push`) · pnpm.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env.local   # completa las variables
pnpm dev
```

Variables (ver `.env.example`): `TAFINANCE_PIN`, `TAFINANCE_SECRET`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `MCP_TOKEN`.

Base de datos: aplica las migraciones de `supabase/migrations/` (la última agrega tarjetas, transferencias entre cuentas y `push_subscriptions`).

Pruebas:

```bash
pnpm test
```

## Notificaciones push

1. Genera las claves: `npx web-push generate-vapid-keys`.
2. Define `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` y `CRON_SECRET` en Vercel.
3. `vercel.json` programa `/api/push/cron` cada día a las 13:00 UTC (08:00 Colombia). Vercel envía `Authorization: Bearer $CRON_SECRET`.
4. En la app: Ajustes → Avisos de pagos y cortes → Activar. En iPhone, primero instala la app en la pantalla de inicio.

## Servidor MCP (opcional)

`/api/mcp` queda deshabilitado hasta definir `MCP_TOKEN`; los clientes deben enviar `Authorization: Bearer <MCP_TOKEN>` (o `?token=`).

## Seguridad

- Sin `TAFINANCE_PIN` en producción se usa un PIN de desarrollo: **defínelo siempre**.
- La biometría se valida en el servidor (firma WebAuthn) y queda ligada al dispositivo mediante una cookie firmada.
- Las tablas de Supabase usan políticas abiertas (uso personal). Para endurecer, define `SUPABASE_SERVICE_ROLE_KEY` y mueve el acceso a rutas del servidor.

## Licencia

MIT
