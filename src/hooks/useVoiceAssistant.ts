"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { OrbState } from "@/components/voice/VoiceOrb";
import { ParsedVoiceTransaction } from "@/types/finance";
import { logger } from "@/lib/debug/logger";
import { todayStr } from "@/lib/finance/calc";
import { blobToGeminiAudio } from "@/lib/audio/wav";

interface UseVoiceAssistantOptions {
  onParsed?: (result: ParsedVoiceTransaction) => void;
  /** Nombres de las categorías reales para que la IA elija una de ellas. */
  getCategories?: () => string[];
}

type Engine = "speech" | "recorder";

const SR_BROKEN_KEY = "tafinance_sr_broken";
/** Sesiones seguidas en que Web Speech terminó sin texto; al llegar a 2 se usa directo la grabadora. */
const SR_EMPTY_KEY = "tafinance_sr_empty";
const MAX_RECORD_MS = 12000;
const SILENCE_AFTER_SPEECH_MS = 1600;

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

function micErrorMessage(err: any): string {
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Permiso de micrófono denegado. Actívalo desde el candado de la barra de direcciones y vuelve a intentar.";
    case "NotFoundError":
      return "No se detectó ningún micrófono en este dispositivo.";
    case "NotReadableError":
      return "El micrófono está siendo usado por otra aplicación.";
    default:
      return "No se pudo acceder al micrófono. También puedes escribir el gasto abajo.";
  }
}

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const [state, setState] = useState<OrbState>("idle");
  const [transcript, setTranscript] = useState("");
  const [volume, setVolume] = useState(0);
  const [parsedResult, setParsedResult] = useState<ParsedVoiceTransaction | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Número de sesión: invalida callbacks tardíos de sesiones canceladas. */
  const sessionRef = useRef(0);
  const finishedRef = useRef(false);
  /** El usuario tocó el orbe para terminar: si no hubo texto, no se pasa a la grabadora. */
  const stopRequestedRef = useRef(false);

  /* ------------------------------ utilidades ------------------------------ */

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const releaseAudio = useCallback(() => {
    clearTimers();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    setVolume(0);
  }, []);

  const parseTranscript = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setState("idle");
      return;
    }
    setTranscript(trimmed);
    setState("processing");
    logger.info("voice", "Interpretando texto", { text: trimmed });
    try {
      const response = await fetch("/api/voice/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          categories: optionsRef.current.getCategories?.(),
          today: todayStr(),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Error ${response.status} al interpretar`);
      }
      const data: ParsedVoiceTransaction = await response.json();
      if (!(data.amount > 0)) {
        setParsedResult(null);
        setErrorMsg("No pude detectar el monto. Intenta decir, por ejemplo: «gasté 45 mil en almuerzo».");
        setState("error");
        logger.warn("voice", "Sin monto detectado", data);
        return;
      }
      setParsedResult(data);
      setState("success");
      logger.info("voice", "Movimiento interpretado", data);
      optionsRef.current.onParsed?.(data);
    } catch (err: any) {
      logger.error("voice", "Fallo al interpretar", err);
      setErrorMsg(err?.message || "Error al clasificar el comando");
      setState("error");
    }
  }, []);

  const finalize = useCallback(
    (text: string, session: number) => {
      if (session !== sessionRef.current || finishedRef.current) return;
      finishedRef.current = true;
      releaseAudio();
      if (text.trim()) void parseTranscript(text);
      else {
        setErrorMsg("No escuché nada. Acerca el micrófono e inténtalo de nuevo, o escribe abajo.");
        setState("error");
      }
    },
    [parseTranscript, releaseAudio]
  );

  /* ------------------------------ volumen ------------------------------ */

  /** Conecta el stream a un analizador; llama a onSilence cuando hubo voz y luego silencio. */
  const startAnalyser = useCallback((stream: MediaStream, onSilence?: () => void) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let spoke = false;
      let lastVoice = performance.now();

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setVolume(Math.min(1, avg / 60));
        const now = performance.now();
        if (avg > 14) {
          spoke = true;
          lastVoice = now;
        } else if (spoke && onSilence && now - lastVoice > SILENCE_AFTER_SPEECH_MS) {
          onSilence();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      logger.warn("voice", "Analizador de volumen no disponible", e);
    }
  }, []);

  /* ------------------------------ motor: grabadora + Gemini ------------------------------ */

  const startRecorder = useCallback(
    (stream: MediaStream, session: number) => {
      const mime = pickMime();
      if (typeof MediaRecorder === "undefined" || !mime) {
        setErrorMsg("Este navegador no puede grabar audio. Escribe el gasto en el campo de texto.");
        setState("error");
        releaseAudio();
        return;
      }
      setEngine("recorder");
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        if (session !== sessionRef.current || finishedRef.current) return;
        const blob = new Blob(chunksRef.current, { type: mime });
        logger.info("voice", "Audio grabado", { bytes: blob.size, mime });
        if (blob.size < 1500) {
          finalize("", session);
          return;
        }
        finishedRef.current = true;
        releaseAudio();
        setState("processing");
        try {
          // Gemini no soporta audio/webm de forma oficial: se envía como WAV 16 kHz mono
          const audio = await blobToGeminiAudio(blob);
          logger.info("voice", "Audio listo para Gemini", { mimeType: audio.mimeType, converted: audio.converted, b64: audio.base64.length });
          const res = await fetch("/api/voice/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio: audio.base64,
              mimeType: audio.mimeType,
              categories: optionsRef.current.getCategories?.(),
              today: todayStr(),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `Error ${res.status} al transcribir`);
          if (!data.transcript) {
            setErrorMsg("No se entendió el audio. Intenta de nuevo o escribe abajo.");
            setState("error");
            return;
          }
          setTranscript(data.transcript);
          if (data.parsed?.amount > 0) {
            setParsedResult(data.parsed);
            setState("success");
            logger.info("voice", "Transcrito por Gemini", data);
            optionsRef.current.onParsed?.(data.parsed);
          } else {
            await parseTranscript(data.transcript);
          }
        } catch (err: any) {
          logger.error("voice", "Transcripción por servidor falló", err);
          setErrorMsg(err?.message || "Error al transcribir");
          setState("error");
        }
      };
      rec.start();
      setState("listening");
      logger.info("voice", "Grabando (motor servidor)", { mime });

      const stop = () => {
        if (rec.state !== "inactive") rec.stop();
      };
      startAnalyser(stream, stop);
      timersRef.current.push(setTimeout(stop, MAX_RECORD_MS));
    },
    [finalize, parseTranscript, releaseAudio, startAnalyser]
  );

  /* ------------------------------ motor: grabadora (abre el micrófono) ------------------------------ */

  /** Pide el micrófono y arranca la grabadora + Gemini. Plan B o motor principal si no hay Web Speech. */
  const startRecorderSession = useCallback(
    async (session: number) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMsg("Este navegador no permite usar el micrófono (¿conexión no segura?). Escribe el gasto abajo.");
        setState("error");
        logger.warn("voice", "mediaDevices no disponible");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (err: any) {
        logger.warn("voice", "Micrófono no disponible", err);
        if (session !== sessionRef.current) return;
        setErrorMsg(micErrorMessage(err));
        setState("error");
        return;
      }
      if (session !== sessionRef.current || finishedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaStreamRef.current = stream;
      startRecorder(stream, session);
    },
    [startRecorder]
  );

  /* ------------------------------ motor: Web Speech ------------------------------ */

  /**
   * Web Speech abre el micrófono por su cuenta. NO se abre getUserMedia en paralelo:
   * en Chrome Android (y la app TWA) el micrófono no se comparte, el reconocedor queda
   * sordo y termina con "no-speech" aunque el usuario hable. El volumen del orbe se
   * simula con los eventos de sonido del propio reconocedor.
   */
  const startSpeech = useCallback(
    (SpeechRecognition: any, session: number) => {
      setEngine("speech");
      const recognition = new SpeechRecognition();
      recognition.lang = "es-CO";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
      let gotAnyResult = false;
      let heardSound = false;
      let lastError: string | null = null;
      let pulse: ReturnType<typeof setInterval> | null = null;

      const stopPulse = () => {
        if (pulse) clearInterval(pulse);
        pulse = null;
        setVolume(0);
      };
      const startPulse = () => {
        if (pulse) return;
        pulse = setInterval(() => setVolume(0.35 + Math.random() * 0.5), 120);
      };

      recognition.onstart = () => {
        if (session !== sessionRef.current) return;
        setState("listening");
        logger.info("voice", "Escuchando (Web Speech)");
      };
      recognition.onsoundstart = () => {
        heardSound = true;
        if (session === sessionRef.current) startPulse();
      };
      recognition.onspeechstart = recognition.onsoundstart;
      recognition.onsoundend = stopPulse;
      recognition.onresult = (event: any) => {
        if (session !== sessionRef.current) return;
        gotAnyResult = true;
        let text = "";
        for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
        transcriptRef.current = text;
        setTranscript(text);
      };
      recognition.onerror = (event: any) => {
        if (session !== sessionRef.current) return;
        lastError = event.error;
        logger.warn("voice", "Error de Web Speech", event.error);
        // la decisión (finalizar o pasar a la grabadora) se toma en onend, cuando el
        // reconocedor ya liberó el micrófono
      };
      recognition.onend = () => {
        stopPulse();
        if (session !== sessionRef.current || finishedRef.current) return;
        if (recognitionRef.current !== recognition) return;
        recognitionRef.current = null;

        const text = transcriptRef.current.trim();
        if (text) {
          try {
            localStorage.removeItem(SR_EMPTY_KEY);
          } catch {}
          finalize(text, session);
          return;
        }
        if (lastError === "aborted" || stopRequestedRef.current) {
          finalize("", session);
          return;
        }

        // Sin texto: o el motor no sirve aquí (network, audio-capture, service-not-allowed,
        // not-allowed en algunos WebView…) o no captó la voz. En ambos casos se reintenta en
        // la misma sesión con grabadora + Gemini, que no depende del servicio de Google.
        const hardFailure = !!lastError && lastError !== "no-speech";
        let empties = 0;
        try {
          empties = Number(localStorage.getItem(SR_EMPTY_KEY) || "0") + 1;
          localStorage.setItem(SR_EMPTY_KEY, String(empties));
          if (hardFailure || empties >= 2) localStorage.setItem(SR_BROKEN_KEY, "1");
        } catch {}
        logger.warn("voice", "Web Speech sin texto; usando grabadora + Gemini", {
          error: lastError,
          heardSound,
          gotAnyResult,
          empties,
        });
        setTranscript("");
        void startRecorderSession(session);
      };

      recognition.start();
    },
    [finalize, startRecorderSession]
  );

  /* ------------------------------ API pública ------------------------------ */

  const startListening = useCallback(async () => {
    const session = ++sessionRef.current;
    finishedRef.current = false;
    stopRequestedRef.current = false;
    setErrorMsg(null);
    setTranscript("");
    transcriptRef.current = "";
    setParsedResult(null);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let broken = false;
    try {
      broken = localStorage.getItem(SR_BROKEN_KEY) === "1";
    } catch {}

    if (SpeechRecognition && !broken) {
      try {
        // se arranca de forma síncrona, dentro del gesto del usuario
        startSpeech(SpeechRecognition, session);
        return;
      } catch (e) {
        recognitionRef.current = null;
        logger.warn("voice", "Web Speech no arrancó", e);
      }
    }
    await startRecorderSession(session);
  }, [startRecorderSession, startSpeech]);

  const stopListening = useCallback(() => {
    logger.debug("voice", "Detener escucha");
    const session = sessionRef.current;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop(); // onstop procesa el audio
      return;
    }
    if (recognitionRef.current) {
      stopRequestedRef.current = true;
      try {
        recognitionRef.current.stop(); // onend finaliza una sola vez
        return;
      } catch {}
    }
    finalize(transcriptRef.current, session);
  }, [finalize]);

  const reset = useCallback(() => {
    sessionRef.current++; // invalida callbacks pendientes
    finishedRef.current = true;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    try {
      rec?.abort();
    } catch {}
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {}
    }
    recorderRef.current = null;
    releaseAudio();
    setState("idle");
    setTranscript("");
    transcriptRef.current = "";
    setParsedResult(null);
    setErrorMsg(null);
  }, [releaseAudio]);

  /** Permite volver a probar Web Speech (por si la red/permisos ya funcionan). */
  const resetEngineFlag = useCallback(() => {
    try {
      localStorage.removeItem(SR_BROKEN_KEY);
      localStorage.removeItem(SR_EMPTY_KEY);
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current++;
      try {
        recognitionRef.current?.abort();
      } catch {}
      releaseAudio();
    };
  }, [releaseAudio]);

  return {
    state,
    transcript,
    volume,
    parsedResult,
    errorMsg,
    engine,
    startListening,
    stopListening,
    reset,
    resetEngineFlag,
    setTranscript,
    parseTranscript,
  };
}
