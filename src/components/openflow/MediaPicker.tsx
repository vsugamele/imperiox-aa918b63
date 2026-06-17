import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Mic, Video, FileText, X } from "lucide-react";
import { FlowMediaLibrary, type FlowMedia } from "./FlowMediaLibrary";

interface Props {
  value?: { id?: string; url?: string; label?: string } | null;
  kind?: "audio" | "image" | "video" | "doc";
  projects?: { id: string; name: string }[];
  onChange: (m: { id: string; url: string; label: string; kind: FlowMedia["kind"] } | null) => void;
}

const kindIcon = { audio: Mic, image: ImageIcon, video: Video, doc: FileText };

export function MediaPicker({ value, kind, projects = [], onChange }: Props) {
  const [open, setOpen] = useState(false);
  const Icon = kind ? kindIcon[kind] : ImageIcon;

  if (value?.url) {
    return (
      <div className="flex items-center gap-2 p-2 bg-slate-950/50 border border-white/10 rounded">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs truncate flex-1" title={value.label}>{value.label || "Mídia selecionada"}</span>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setOpen(true)}>Trocar</Button>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-rose-400" onClick={() => onChange(null)}><X className="h-3 w-3" /></Button>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild><div /></PopoverTrigger>
          <PopoverContent className="w-[640px] max-h-[70vh] overflow-y-auto bg-secondary/95 border-white/10" align="start">
            <FlowMediaLibrary
              projects={projects}
              selectMode
              filterKind={kind}
              onSelect={(m) => { onChange({ id: m.id, url: m.url, label: m.label, kind: m.kind }); setOpen(false); }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs w-full border-dashed">
          <Icon className="h-3 w-3 mr-1" /> Escolher {kind || "mídia"} da biblioteca
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[640px] max-h-[70vh] overflow-y-auto bg-secondary/95 border-white/10" align="start">
        <FlowMediaLibrary
          projects={projects}
          selectMode
          filterKind={kind}
          onSelect={(m) => { onChange({ id: m.id, url: m.url, label: m.label, kind: m.kind }); setOpen(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}
