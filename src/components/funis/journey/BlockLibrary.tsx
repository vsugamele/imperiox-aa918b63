import { cn } from "@/lib/utils";

export interface BlockType {
  id: string;
  label: string;
  icon: string;
  desc: string;
  color: string;
}

export const BLOCK_TYPES: BlockType[] = [
  { id: "vsl", label: "VSL", icon: "🎬", desc: "Roteiro de vídeo de vendas", color: "border-rose-500/40 bg-rose-500/5" },
  { id: "email", label: "E-mail", icon: "✉️", desc: "Cópia ou sequência de e-mail", color: "border-sky-500/40 bg-sky-500/5" },
  { id: "ad_copy", label: "Copy de Anúncio", icon: "📣", desc: "Título + primária + descrição", color: "border-amber-500/40 bg-amber-500/5" },
  { id: "landing", label: "Landing Page", icon: "🌐", desc: "Estrutura + copy de LP", color: "border-emerald-500/40 bg-emerald-500/5" },
  { id: "wa_seq", label: "Seq. WhatsApp", icon: "💬", desc: "Sequência de mensagens", color: "border-green-500/40 bg-green-500/5" },
  { id: "reels", label: "Reels/Story", icon: "📱", desc: "Roteiro Instagram", color: "border-pink-500/40 bg-pink-500/5" },
  { id: "qualif", label: "Qualificação", icon: "✅", desc: "Formulário/quiz", color: "border-violet-500/40 bg-violet-500/5" },
];

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
