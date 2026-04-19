import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, Type, Gauge } from "lucide-react";

interface ExpertTeleprompterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  title?: string;
}

export function ExpertTeleprompter({ open, onOpenChange, text, title }: ExpertTeleprompterProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // px per frame
  const [fontSize, setFontSize] = useState(32);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setPlaying(false);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
  }, [open]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop += speed;
        const max = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
        if (scrollRef.current.scrollTop >= max) {
          setPlaying(false);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed]);

  const reset = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setPlaying(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full w-screen h-screen sm:max-w-full p-0 bg-black border-0 rounded-none flex flex-col">
        <DialogHeader className="px-4 py-2 border-b border-border bg-background/80 backdrop-blur">
          <DialogTitle className="text-sm flex items-center gap-2">
            <Type className="h-4 w-4 text-primary" /> Teleprompter — {title || "Roteiro"}
          </DialogTitle>
        </DialogHeader>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-background/80 backdrop-blur border-b border-border">
          <Button size="sm" variant={playing ? "destructive" : "default"} onClick={() => setPlaying(p => !p)} className="gap-1.5">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pausar" : "Iniciar"}
          </Button>
          <Button size="sm" variant="outline" onClick={reset} className="gap-1.5">
            <RotateCcw className="h-4 w-4" /> Reiniciar
          </Button>

          <div className="flex items-center gap-2 min-w-[140px]">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Velocidade</span>
            <Slider value={[speed]} min={0.3} max={5} step={0.1} onValueChange={v => setSpeed(v[0])} className="w-20" />
            <span className="text-[10px] tabular-nums w-8">{speed.toFixed(1)}x</span>
          </div>

          <div className="flex items-center gap-2 min-w-[140px]">
            <Type className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Fonte</span>
            <Slider value={[fontSize]} min={18} max={72} step={2} onValueChange={v => setFontSize(v[0])} className="w-20" />
            <span className="text-[10px] tabular-nums w-8">{fontSize}px</span>
          </div>
        </div>

        {/* Scrolling text */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-black text-white px-8 py-[40vh] scroll-smooth"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
        >
          <div className="max-w-4xl mx-auto whitespace-pre-wrap font-medium tracking-wide text-center">
            {text || "Sem roteiro disponível."}
          </div>
        </div>

        {/* Center reading line indicator */}
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-primary/40" />
      </DialogContent>
    </Dialog>
  );
}
