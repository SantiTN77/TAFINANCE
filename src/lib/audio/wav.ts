/**
 * Utilidades de audio para el plan B de la voz.
 * Gemini no lista audio/webm (lo que graba Chrome Android) entre sus formatos soportados,
 * así que convertimos la grabación a WAV PCM 16 bit mono a 16 kHz: universal y pequeño
 * (~32 KB por segundo, ~400 KB para 12 s).
 */

export const TARGET_SAMPLE_RATE = 16000;

/** Promedia canales y reduce la frecuencia de muestreo (promedio por bloques, suficiente para voz). */
export function downmixAndResample(channels: Float32Array[], fromRate: number, toRate = TARGET_SAMPLE_RATE): Float32Array {
  if (!channels.length) return new Float32Array(0);
  const len = channels[0].length;
  const mono = new Float32Array(len);
  for (const ch of channels) for (let i = 0; i < len; i++) mono[i] += ch[i] / channels.length;
  if (fromRate <= toRate) return mono;

  const ratio = fromRate / toRate;
  const outLen = Math.floor(len / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(len, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += mono[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

/** Codifica muestras float [-1, 1] como WAV PCM 16 bit mono. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // tamaño del bloque fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits por muestra
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Convierte la grabación del navegador a WAV 16 kHz mono (solo navegador).
 * Si el navegador no puede decodificarla, devuelve el audio original.
 */
export async function blobToGeminiAudio(blob: Blob): Promise<{ base64: string; mimeType: string; converted: boolean }> {
  const raw = new Uint8Array(await blob.arrayBuffer());
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AudioCtx();
    try {
      const decoded = await ctx.decodeAudioData(raw.slice().buffer);
      const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
      const samples = downmixAndResample(channels, decoded.sampleRate);
      const rate = decoded.sampleRate <= TARGET_SAMPLE_RATE ? decoded.sampleRate : TARGET_SAMPLE_RATE;
      return { base64: bytesToBase64(encodeWav(samples, rate)), mimeType: "audio/wav", converted: true };
    } finally {
      ctx.close().catch(() => {});
    }
  } catch {
    return { base64: bytesToBase64(raw), mimeType: (blob.type || "audio/webm").split(";")[0], converted: false };
  }
}
