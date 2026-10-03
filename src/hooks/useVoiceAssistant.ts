"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { OrbState } from "@/components/voice/VoiceOrb";
import { ParsedVoiceTransaction } from "@/types/finance";

interface UseVoiceAssistantOptions {
  onParsed?: (result: ParsedVoiceTransaction) => void;
  apiKey?: string;
}

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const [state, setState] = useState<OrbState>("idle");
  const [transcript, setTranscript] = useState("");
  const [volume, setVolume] = useState(0);
  const [parsedResult, setParsedResult] = useState<ParsedVoiceTransaction | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Audio level analyzer
  const startVolumeAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(1, Math.max(0, average / 100));
        setVolume(normalized);

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn("No se pudo iniciar el análisis de volumen del micrófono:", err);
    }
  }, []);

  const stopVolumeAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    setVolume(0);
  }, []);

  const parseTranscript = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      setState("processing");
      try {
        const response = await fetch("/api/voice/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, apiKey: options.apiKey }),
        });

        if (!response.ok) {
          throw new Error("Error procesando transcripción");
        }

        const data: ParsedVoiceTransaction = await response.json();
        setParsedResult(data);
        setState("success");
        if (options.onParsed) {
          options.onParsed(data);
        }
      } catch (err: any) {
        console.error("Error al parsear:", err);
        setErrorMsg(err.message || "Error al clasificar");
        setState("error");
      }
    },
    [options]
  );

  const startListening = useCallback(async () => {
    setErrorMsg(null);
    setTranscript("");
    setParsedResult(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg("El navegador no soporta reconocimiento de voz nativo.");
      setState("error");
      return;
    }

    try {
      await startVolumeAnalysis();

      const recognition = new SpeechRecognition();
      recognition.lang = "es-CO"; // Español Colombia / Latinoamericano
      recognition.continuous = false;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setState("listening");
      };

      recognition.onresult = (event: any) => {
        let currentText = "";
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript;
        }
        setTranscript(currentText);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error !== "no-speech") {
          setErrorMsg("Error en el micrófono: " + event.error);
          setState("error");
        }
        stopVolumeAnalysis();
      };

      recognition.onend = () => {
        stopVolumeAnalysis();
        if (transcript) {
          parseTranscript(transcript);
        } else {
          setState("idle");
        }
      };

      recognition.start();
    } catch (err: any) {
      console.error("Error al iniciar micrófono:", err);
      setErrorMsg("Permiso de micrófono denegado.");
      setState("error");
      stopVolumeAnalysis();
    }
  }, [startVolumeAnalysis, stopVolumeAnalysis, transcript, parseTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    stopVolumeAnalysis();
    if (transcript) {
      parseTranscript(transcript);
    } else {
      setState("idle");
    }
  }, [stopVolumeAnalysis, transcript, parseTranscript]);

  const reset = useCallback(() => {
    stopListening();
    setState("idle");
    setTranscript("");
    setParsedResult(null);
    setErrorMsg(null);
  }, [stopListening]);

  useEffect(() => {
    return () => {
      stopVolumeAnalysis();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [stopVolumeAnalysis]);

  return {
    state,
    transcript,
    volume,
    parsedResult,
    errorMsg,
    startListening,
    stopListening,
    reset,
    setTranscript,
    parseTranscript,
  };
}
