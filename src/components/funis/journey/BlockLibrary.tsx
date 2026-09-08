import { BlockType, BLOCK_TYPES } from "@/components/funis/journey/block-library-data";
import { cn } from "@/lib/utils";





interface Props {
  onDragStart: (b: BlockType) => void;
  onDragEnd: () => void;
}

export function BlockLibrary({ onDragStart, onDragEnd }: Props) {
  return (
    <aside className="w-[220px] shrink-0 rounded-lg border border-border/60 bg-[#0a0608]/60 p-2 overflow-y-auto">
      <div className="px-1 pb-2 border-b border-border/40 mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider">Blocos</h3>
        <p className="text-[9px] text-muted-foreground">Arraste para uma etapa</p>
      </div>
      <div className="space-y-1.5">
        {BLOCK_TYPES.map(b => (
          <div
            key={b.id}
            draggable
            onDragStart={() => onDragStart(b)}
            onDragEnd={onDragEnd}
            className={cn(
              "cursor-grab active:cursor-grabbing rounded-md border p-2 hover:brightness-125 transition",
              b.color
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base">{b.icon}</span>
              <span className="text-xs font-semibold">{b.label}</span>
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">{b.desc}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
