# TAFINANCE para Android (Trusted Web Activity)

La app Android es una **TWA**: abre `https://tafinance.vercel.app/app` en Chrome a pantalla completa. No hay código de UI aquí; cada deploy en Vercel actualiza la app sin pasar por Play.

Generada con [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) a partir de `public/manifest.json`. La configuración fuente es `twa-manifest.json`.

## Por qué TWA y no Capacitor

- La app es Next.js con rutas API, middleware y cookies: no admite `output: export`, así que Capacitor solo podría cargar la URL remota en un WebView.
- El WebView de Android **no soporta Web Push** ni todo WebAuthn; la TWA corre en Chrome y conserva push, biometría, Web Speech y el service worker tal cual.
- Play rechaza apps que son solo un WebView de una web; la TWA es la vía oficial de Google para PWAs.
- Coste: casi cero mantenimiento nativo. Si algún día hace falta una API nativa sin equivalente web (p. ej. widgets, lectura de SMS bancarios), se reevalúa Capacitor.

## APK debug

**CI (recomendado):** el workflow `Android (TWA)` compila en cada PR que toque `android/`. Descarga `tafinance-debug-apk` desde la pestaña *Actions* → ejecución → *Artifacts*. También se puede lanzar a mano (*Run workflow*).

**Local:** requiere JDK 17+ y Android SDK (`ANDROID_HOME`).

```bash
pnpm android:debug        # = cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Instalar en el móvil

1. Ajustes → Opciones de desarrollador → *Depuración USB* (o permite "instalar apps desconocidas" para el navegador/gestor de archivos).
2. `adb install -r app-debug.apk`, o copia el APK al móvil y ábrelo.
3. Requiere Chrome (u otro navegador con soporte TWA) instalado.

Sin verificación de dominio la app funciona, pero muestra una barra de URL arriba (modo Custom Tab). Para quitarla, ver abajo.

## Verificación de dominio (pantalla completa)

`/.well-known/assetlinks.json` lo sirve `src/app/.well-known/assetlinks.json/route.ts` desde la variable de entorno de Vercel:

```
ANDROID_CERT_SHA256=AA:BB:...:FF,11:22:...:EE   # separadas por comas
```

Incluye la huella del certificado con el que firmes (la de *Play App Signing* cuando publiques; para pruebas, la del keystore debug que imprime el job de CI o `keytool -list -v -keystore ~/.android/debug.keystore -storepass android`). Sin la variable, la ruta responde 404.

Comprobar: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://tafinance.vercel.app&relation=delegate_permission/common.handle_all_urls`

## Release para Play Store

```bash
npm i -g @bubblewrap/cli
cd android
bubblewrap build            # crea android.keystore la primera vez y firma APK + AAB
```

- `android.keystore` y sus contraseñas **nunca** se suben al repo (`.gitignore` lo excluye). Guárdalas en un gestor de secretos; perderlas impide actualizar la app si no usas Play App Signing.
- Sube el `.aab` a Play Console con *Play App Signing* activado y añade su huella SHA-256 a `ANDROID_CERT_SHA256`.
- Sube `appVersionCode` en `twa-manifest.json` en cada release.
- Tras cambiar `public/manifest.json` (iconos, colores, atajos): `bubblewrap update` regenera el proyecto.

El `applicationId` (`app.tafinance`) es permanente una vez publicado en Play.
