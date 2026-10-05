import { NextResponse } from "next/server";

// Digital Asset Links: vincula la app Android (TWA) con este dominio para que
// se abra a pantalla completa, sin barra de URL. Las huellas SHA-256 de los
// certificados de firma (Play App Signing + subida/debug) se configuran en
// ANDROID_CERT_SHA256, separadas por comas. Sin huellas, responde 404.
const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME || "app.tafinance";
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export const dynamic = "force-dynamic";

export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => FINGERPRINT.test(f));

  if (fingerprints.length === 0) {
    return NextResponse.json([], { status: 404 });
  }

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: PACKAGE_NAME,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
