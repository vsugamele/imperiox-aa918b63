import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Smartphone, X, Clock, GitFork, Bot, Tag, Zap, Image as ImageIcon, Mic, Mail } from "lucide-react";

interface Props {
  acoes: any[];
  triggerTipo: string;
  onClose: () => void;
}

// Extrai o texto/preview visível de cada tipo de ação (o que o lead "veria")
function bubbleFromAcao(a: any): { role: "bot" | "system"; kind: string; text: string; icon?: any } | null {
  const t = a?.tipo;
  const cfg = a?.config || a || {};
  if (t === "whatsapp") {
    const txt = cfg.mensagem || cfg.text || cfg.content || "";
    return { role: "bot", kind: "text", text: txt || "(mensagem vazia)" };
  }
  if (t === "audio") return { role: "bot", kind: "audio", text: cfg.transcript || cfg.mensagem || "🎤 Áudio", icon: Mic };
  if (t === "generate_image" || cfg.image_url) return { role: "bot", kind: "image", text: cfg.prompt || cfg.caption || "🖼️ Imagem gerada", icon: ImageIcon };
  if (t === "email") return { role: "bot", kind: "email", text: `📧 ${cfg.assunto || cfg.subject || "E-mail"}`, icon: Mail };
  if (t === "ia_message" || t === "gpt_prompt" || t === "ai_agent") {
    return { role: "bot", kind: "ai", text: cfg.prompt || cfg.mensagem || "🤖 Resposta gerada por IA", icon: Bot };
  }
  if (t === "aguardar" || t === "delay" || t === "espera") {
    const min = cfg.minutos || cfg.minutes || cfg.delay_minutes || 0;
    const hr = cfg.horas || cfg.hours || 0;
    const label = hr ? `${hr}h ${min ? min + "min" : ""}` : `${min || 0}min`;
    return { role: "system", kind: "delay", text: `⏱ aguardando ${label}`, icon: Clock };
  }
  if (t === "condicao" || t === "condition" || t === "ab_split" || t === "semantic_router") {
    return { role: "system", kind: "branch", text: `🔀 ${t === "ab_split" ? "A/B split" : "condição / branch"}`, icon: GitFork };
  }
  if (t === "adicionar_tag" || t === "remover_tag") {
    return { role: "system", kind: "tag", text: `🏷 ${t === "adicionar_tag" ? "+ tag " : "- tag "}${cfg.tag || cfg.nome || ""}`, icon: Tag };
  }
  if (t === "webhook_call") return { role: "system", kind: "webhook", text: `🔗 webhook → ${cfg.url || "?"}`, icon: Zap };
  if (t === "wait_reply" || t === "input_capture") return { role: "system", kind: "wait", text: `👂 aguardando resposta${cfg.variable ? ` → {{${cfg.variable}}}` : ""}` };
  return null;
}

export function FlowLivePreview({ acoes, triggerTipo, onClose }: Props) {
  const bubbles = useMemo(() => acoes.map(bubbleFromAcao).filter(Boolean) as ReturnType<typeof bubbleFromAcao>[], [acoes]);

  return (
    <div className="absolute top-3 left-3 z-30 w-80 max-h-[calc(100%-1.5rem)] flex flex-col rounded-2xl border border-primary/30 bg-slate-950/95 backdrop-blur-md shadow-2xl shadow-primary/10 animate-slide-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-gradient-to-r from-primary/15 to-transparent rounded-t-2xl">
        <div className="flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Preview ao vivo</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%224%22%20height%3D%224%22%3E%3Ccircle%20cx%3D%221%22%20cy%3D%221%22%20r%3D%220.5%22%20fill%3D%22%23222%22%2F%3E%3C%2Fsvg%3E')]">
        {/* Bolha do gatilho */}
        <div className="flex justify-center">
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800/80 text-muted-foreground uppercase tracking-widest">
            ⚡ {triggerTipo.replace(/_/g, " ")}
          </span>
        </div>

        {bubbles.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8 italic">
            Adicione ações no canvas para ver o preview aqui.
          </div>
        )}

        {bubbles.map((b, i) => {
          if (!b) return null;
          if (b.role === "system") {
            return (
              <div key={i} className="flex justify-center">
                <span className="text-[10px] px-2 py-1 rounded-full bg-slate-800/60 text-muted-foreground/80 border border-border/40">
                  {b.text}
                </span>
              </div>
            );
          }
          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-[#202c33] text-slate-100 px-3 py-2 text-xs leading-snug shadow whitespace-pre-wrap break-words">
                {b.text}
                <div className="text-[9px] text-slate-400 text-right mt-1">passo {i + 1}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-border/60 text-[9px] text-muted-foreground/70 rounded-b-2xl bg-slate-950/80">
        Atualiza automaticamente enquanto você edita.
      </div>
    </div>
  );
}
