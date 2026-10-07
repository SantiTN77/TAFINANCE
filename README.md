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

Variables (ver `.env.example`): `TAFINANCE_PIN`, `TAFINANCE_SECRET`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`, `MCP_TOKEN`.

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

`/api/mcp` queda deshabilitado hasta definir `MCP_TOKEN` y `MCP_USER_ID` (uuid del usuario dueño de los datos); los clientes deben enviar `Authorization: Bearer <MCP_TOKEN>` (o `?token=`).

## Multiusuario y administración

- Cada usuario entra con correo y contraseña (Supabase Auth) y solo ve sus datos: RLS por `auth.uid()` con claves `(user_id, id)` y FKs compuestas (`supabase/migrations/20261005*.sql`). Desactiva "Allow new users to sign up" en Supabase; si alguien se registra igual queda `pending`, sin acceso a datos.
- El panel `/admin` (solo rol admin y sesión iniciada con contraseña) crea usuarios, los deshabilita, cambia roles, restablece contraseñas y borra cuentas. Nunca muestra datos financieros ajenos. Todo queda en `admin_audit`.
- PIN y huella son un desbloqueo rápido solo del dueño (`TAFINANCE_OWNER_EMAIL`) y no dan acceso al panel admin.
- Prueba de aislamiento (Postgres local, no toca Supabase): `TEST_DATABASE_URL=postgresql:///tafmt ./scripts/test-rls.sh`.

### Orden de despliegue (migración desde una sola bóveda)

1. Aplicar `20261005a` (aditiva, segura en cualquier momento).
2. Crear en Supabase Auth el usuario dueño y ejecutar `select public.taf_assign_legacy_data('<uuid>')`: le asigna todos los datos actuales y lo hace admin. Comprobar los conteos devueltos.
3. Definir en Vercel `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TAFINANCE_OWNER_EMAIL` y `MCP_USER_ID`; aplicar `20261005c` y desplegar el código **juntos** (el código nuevo no funciona con el esquema anterior y viceversa).

## Seguridad

- Falla cerrado: sin `TAFINANCE_PIN` (mín. 4) y `TAFINANCE_SECRET` (mín. 32 caracteres) no hay desbloqueo rápido y las cookies de dispositivo no se firman.
- La biometría se valida en el servidor (firma WebAuthn), queda ligada al dispositivo mediante una cookie firmada y solo la puede registrar la cuenta del dueño.
- El navegador solo conoce la clave anónima, que sin el JWT de un usuario activo no abre ninguna tabla. `SUPABASE_SERVICE_ROLE_KEY` es solo del servidor (admin, cron, limitador, MCP).
- Los intentos de acceso se limitan en la BD (`auth_throttle`): 5 por IP, 20 globales y 8 por correo, con bloqueo creciente.

## Licencia

MIT
