// Genera los iconos PNG de la PWA a partir de public/icon.svg (ejecutar: node scripts/gen-icons.mjs)
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync(new URL("../public/icon.svg", import.meta.url));
const out = (n) => new URL(`../public/${n}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out(name));
}

// Maskable: fondo sólido a sangre completa y arte al 66% (zona segura)
const bg = await sharp({ create: { width: 512, height: 512, channels: 4, background: "#070A11" } }).png().toBuffer();
const art = await sharp(svg, { density: 384 }).resize(338, 338).png().toBuffer();
await sharp(bg).composite([{ input: art, gravity: "center" }]).png().toFile(out("icon-maskable-512.png"));

// Badge monocromo para notificaciones (Android)
const badge = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="44" fill="#fff"/><path d="M48 24V72M33 38C33 30 63 30 63 42C63 54 33 50 33 62C33 72 63 72 63 62" stroke="#000" stroke-width="7" stroke-linecap="round" fill="none"/></svg>`);
await sharp(badge).resize(96, 96).png().toFile(out("badge-96.png"));
console.log("Iconos generados");
