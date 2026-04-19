import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Mic, Square, Play, Upload, Loader2, RefreshCw, Camera as CameraIcon } from "lucide-react";
import { toast } from "sonner";

interface ExpertRecorderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "video" | "audio";
  onUpload: (file: File) => Promise<void>;
  contentId: string;
}

export function ExpertRecorder({ open, onOpenChange, mode, onUpload, contentId }: ExpertRecorderProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const startStream = async (face: "user" | "environment" = facingMode) => {
    try {
      const constraints: MediaStreamConstraints = mode === "video"
        ? { video: { facingMode: { ideal: face } }, audio: true }
        : { audio: true };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(s);
      if (videoRef.current && mode === "video") {
        videoRef.current.srcObject = s;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e: any) {
      toast.error("Permissão de câmera/microfone negada: " + (e?.message || ""));
      onOpenChange(false);
    }
  };

  useEffect(() => {
    if (open) {
      setRecordedBlob(null);
      setPreviewUrl(null);
      setElapsed(0);
      startStream();
    } else {
      // Cleanup
      stream?.getTracks().forEach(t => t.stop());
      setStream(null);
      setRecording(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const switchCamera = async () => {
    if (mode !== "video") return;
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    stream?.getTracks().forEach(t => t.stop());
    await startStream(next);
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = mode === "video"
      ? (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm")
      : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg");
    const mr = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    };
    mr.start();
    setRecording(true);
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
  };

  const discard = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setRecordedBlob(null);
    setPreviewUrl(null);
    setElapsed(0);
  };

  const handleUpload = async () => {
    if (!recordedBlob) return;
    setUploading(true);
    try {
      const ext = mode === "video" ? "webm" : "webm";
      const filename = `${contentId}_gravacao_${Date.now()}.${ext}`;
      const file = new File([recordedBlob], filename, { type: recordedBlob.type });
      await onUpload(file);
      toast.success(mode === "video" ? "Vídeo enviado!" : "Áudio enviado!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro no upload: " + (e?.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "video" ? <Video className="h-5 w-5 text-primary" /> : <Mic className="h-5 w-5 text-primary" />}
            Gravar {mode === "video" ? "vídeo" : "áudio"}
          </DialogTitle>
          <DialogDescription>
            Use o navegador para gravar direto e enviar — sem precisar de app externo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Preview area */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
            {previewUrl ? (
              mode === "video" ? (
                <video src={previewUrl} controls className="w-full h-full" />
              ) : (
                <audio src={previewUrl} controls className="w-3/4" />
              )
            ) : mode === "video" ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <Mic className={`h-16 w-16 mx-auto ${recording ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
                <p className="text-sm text-muted-foreground mt-2">{recording ? "Gravando áudio..." : "Aguardando microfone"}</p>
              </div>
            )}

            {recording && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <Badge variant="destructive" className="gap-1.5 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-white" /> REC {formatTime(elapsed)}
                </Badge>
              </div>
            )}

            {mode === "video" && !previewUrl && stream && (
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-3 right-3 h-8 w-8"
                onClick={switchCamera}
                title="Trocar câmera"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {!previewUrl ? (
              !recording ? (
                <Button onClick={startRecording} disabled={!stream} className="gap-2" size="lg">
                  {mode === "video" ? <CameraIcon className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  Iniciar gravação
                </Button>
              ) : (
                <Button onClick={stopRecording} variant="destructive" className="gap-2" size="lg">
                  <Square className="h-5 w-5" /> Parar
                </Button>
              )
            ) : (
              <>
                <Button variant="outline" onClick={discard} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Refazer
                </Button>
                <Button onClick={handleUpload} disabled={uploading} className="gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Enviar
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
