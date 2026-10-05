import { downmixAndResample, encodeWav, TARGET_SAMPLE_RATE } from "../src/lib/audio/wav";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("❌", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

console.log("=== Testing TAFINANCE WAV encoder (plan B de voz) ===");

// 1 s de tono a 48 kHz estéreo → 16 kHz mono
const rate = 48000;
const left = new Float32Array(rate).map((_, i) => Math.sin((2 * Math.PI * 440 * i) / rate));
const right = new Float32Array(left);
const mono = downmixAndResample([left, right], rate);
assert(mono.length === TARGET_SAMPLE_RATE, `remuestreo 48k→16k da ${TARGET_SAMPLE_RATE} muestras (dio ${mono.length})`);
assert(Math.max(...Array.from(mono.slice(0, 200)).map(Math.abs)) > 0.9, "la señal conserva amplitud tras el remuestreo");

const wav = encodeWav(mono, TARGET_SAMPLE_RATE);
const view = new DataView(wav.buffer);
const tag = (o: number) => String.fromCharCode(...wav.subarray(o, o + 4));
assert(tag(0) === "RIFF" && tag(8) === "WAVE" && tag(36) === "data", "cabecera RIFF/WAVE/data válida");
assert(view.getUint16(20, true) === 1 && view.getUint16(22, true) === 1, "PCM mono");
assert(view.getUint32(24, true) === 16000 && view.getUint16(34, true) === 16, "16 kHz, 16 bit");
assert(wav.length === 44 + mono.length * 2, "tamaño = cabecera + 2 bytes por muestra");

// muestras fuera de rango se recortan sin desbordar
const clipped = new DataView(encodeWav(new Float32Array([2, -2]), 16000).buffer);
assert(clipped.getInt16(44, true) === 32767 && clipped.getInt16(46, true) === -32768, "recorte de muestras fuera de [-1, 1]");

// una frecuencia menor que la objetivo no se remuestrea
assert(downmixAndResample([new Float32Array(8000)], 8000).length === 8000, "no sube la frecuencia de muestreo");

console.log("Todas las pruebas del codificador WAV pasaron.");
