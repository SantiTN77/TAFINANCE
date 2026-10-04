"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { OrbState } from "@/components/voice/VoiceOrb";
import { ParsedVoiceTransaction } from "@/types/finance";
import { logger } from "@/lib/debug/logger";
import { todayStr } from "@/lib/finance/calc";

interface UseVoiceAssistantOptions {
  onParsed?: (result: ParsedVoiceTransaction) => void;
  /** Nombres de las categorías reales para que la IA elija una de ellas. */
  getCategories?: () => string[];
}

type Engine = "speech" | "recorder";

const SR_BROKEN_KEY = "tafinance_sr_broken";
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
          const buf = new Uint8Array(await blob.arrayBuffer());
          let bin = "";
          for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
          const res = await fetch("/api/voice/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio: btoa(bin),
              mimeType: mime,
              categories: optionsRef.current.getCategories?.(),
              today: todayStr(),
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "No se pudo transcribir");
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

  /* ------------------------------ motor: Web Speech ------------------------------ */

  const startSpeech = useCallback(
    (SpeechRecognition: any, stream: MediaStream, session: number) => {
      setEngine("speech");
      const recognition = new SpeechRecognition();
      recognition.lang = "es-CO";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognitionRef.current = recognition;
      let gotAnyResult = false;

      recognition.onstart = () => {
        if (session !== sessionRef.current) return;
        setState("listening");
        logger.info("voice", "Escuchando (Web Speech)");
      };
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
        logger.warn("voice", "Error de Web Speech", event.error);
        if (event.error === "no-speech" || event.error === "aborted") return; // onend decide
        if (event.error === "not-allowed") {
          finishedRef.current = true;
          releaseAudio();
          setErrorMsg(
            "El reconocimiento de voz está bloqueado en este navegador. Usa el campo de texto o prueba desde Chrome/Safari en tu móvil."
          );
          setState("error");
          return;
        }
        // network / service-not-allowed / language-not-supported → motor roto: pasar a grabadora
        try {
          localStorage.setItem(SR_BROKEN_KEY, "1");
        } catch {}
        logger.warn("voice", "Web Speech no funciona aquí; usando grabadora + Gemini", event.error);
        recognitionRef.current = null;
        if (mediaStreamRef.current?.active) {
          releaseAudioKeepStream();
          startRecorder(stream, session);
        } else {
          setErrorMsg("El reconocimiento de voz del navegador falló (" + event.error + "). Escribe el gasto abajo.");
          setState("error");
        }
      };
      recognition.onend = () => {
        if (session !== sessionRef.current || finishedRef.current) return;
        if (recognitionRef.current === null) return; // ya se cambió de motor
        finalize(transcriptRef.current, session);
        if (!gotAnyResult) logger.debug("voice", "Web Speech terminó sin resultados");
      };

      recognition.start();
      startAnalyser(stream);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finalize, releaseAudio, startAnalyser, startRecorder]
  );

  /** Detiene solo el analizador/timers sin cerrar el stream (al cambiar de motor). */
  function releaseAudioKeepStream() {
    clearTimers();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
  }

  /* ------------------------------ API pública ------------------------------ */

  const startListening = useCallback(async () => {
    const session = ++sessionRef.current;
    finishedRef.current = false;
    setErrorMsg(null);
    setTranscript("");
    transcriptRef.current = "";
    setParsedResult(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("Este navegador no permite usar el micrófono (¿conexión no segura?). Escribe el gasto abajo.");
      setState("error");
      logger.warn("voice", "mediaDevices no disponible");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      logger.warn("voice", "Micrófono no disponible", err);
      setErrorMsg(micErrorMessage(err));
      setState("error");
      return;
    }
    if (session !== sessionRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    mediaStreamRef.current = stream;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let broken = false;
    try {
      broken = localStorage.getItem(SR_BROKEN_KEY) === "1";
    } catch {}

    if (SpeechRecognition && !broken) {
      try {
        startSpeech(SpeechRecognition, stream, session);
        return;
      } catch (e) {
        logger.warn("voice", "Web Speech no arrancó", e);
      }
    }
    startRecorder(stream, session);
  }, [startRecorder, startSpeech]);

  const stopListening = useCallback(() => {
    logger.debug("voice", "Detener escucha");
    const session = sessionRef.current;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop(); // onstop procesa el audio
      return;
    }
    if (recognitionRef.current) {
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
