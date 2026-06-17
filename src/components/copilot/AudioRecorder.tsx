import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

const MAX_SECONDS = 90;

export function AudioRecorder({ onTranscript, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => cleanup(), []);

  const cleanup = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
    chunksRef.current = [];
  };

  const pickMime = () => {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
    }
    return "";
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = handleStop;
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((s) => {
          if (s + 1 >= MAX_SECONDS) { stop(); return MAX_SECONDS; }
          return s + 1;
        });
      }, 1000);
    } catch (e: any) {
      toast.error("Sem permissão de microfone");
    }
  };

  const stop = () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const cancel = () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      // marca para descartar
      mediaRef.current.onstop = () => { cleanup(); };
      mediaRef.current.stop();
    } else { cleanup(); }
    setRecording(false);
  };

  const handleStop = async () => {
    const mime = mediaRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    cleanup();
    if (blob.size < 500) { toast.error("Áudio muito curto"); return; }
    setTranscribing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada");
      const form = new FormData();
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("mpeg") ? "mp3" : "webm";
      form.append("file", blob, `audio.${ext}`);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: form,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Falha na transcrição");
      }
      const j = await res.json();
      if (j.text?.trim()) onTranscript(j.text.trim());
      else toast.error("Não entendi o áudio");
    } catch (e: any) {
      toast.error(e.message || "Falha ao transcrever");
    } finally {
      setTranscribing(false);
    }
  };

  if (transcribing) {
    return (
      <Button size="icon" variant="outline" disabled className="self-end">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (recording) {
    const mm = String(Math.floor(elapsed / 60)).padStart(1, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    return (
      <div className="flex items-center gap-1 self-end">
        <span className="text-[10px] font-mono text-red-400 px-1 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
          {mm}:{ss}
        </span>
        <Button size="icon" variant="ghost" onClick={cancel} title="Cancelar">
          <Square className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="default" onClick={stop} title="Enviar áudio" className={cn("bg-red-500 hover:bg-red-600")}>
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button size="icon" variant="outline" onClick={start} disabled={disabled} title="Gravar áudio" className="self-end">
      <Mic className="h-4 w-4" />
    </Button>
  );
}
