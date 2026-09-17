import { CANVAS_BLOCKS, CanvasBlockType } from "./blockTypes";
import { cn } from "@/lib/utils";

interface Props {
  onDragStart: (b: CanvasBlockType) => void;
  onDragEnd: () => void;
  onPickTemplate: (key: string) => void;
  templates: { key: string; name: string; description: string }[];
}

export function StudioBlockLibrary({ onDragStart, onDragEnd, onPickTemplate, templates }: Props) {
  return (
    <aside className="w-[240px] shrink-0 rounded-lg border border-border/60 bg-[#0a0608]/60 overflow-y-auto flex flex-col">
      <div className="px-3 py-2 border-b border-border/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Blocos</h3>
        <p className="text-[10px] text-muted-foreground">Arraste para o canvas</p>
      </div>
      <div className="p-2 space-y-1.5">
        {CANVAS_BLOCKS.map(b => (
          <div
            key={b.id}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(b); }}
            onDragEnd={onDragEnd}
            className={cn("rounded-md border p-2 cursor-grab active:cursor-grabbing hover:bg-background/60 transition", b.color)}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{b.icon}</span>
              <span className="text-xs font-medium">{b.label}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{b.desc}</p>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-border/40 mt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Templates</h3>
        <p className="text-[10px] text-muted-foreground">Fluxos prontos</p>
      </div>
      <div className="p-2 space-y-1.5">
        {templates.map(t => (
          <button
            key={t.key}
            onClick={() => onPickTemplate(t.key)}
            className="w-full text-left rounded-md border border-border/60 bg-background/40 p-2 hover:border-primary/50 hover:bg-primary/5 transition"
          >
            <div className="text-xs font-medium">{t.name}</div>
            <p className="text-[10px] text-muted-foreground leading-tight">{t.description}</p>
          </button>
        ))}
      </div>
    </aside>
  );
}
