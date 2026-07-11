import { useMemo } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { Acao } from "../FlowEditor";

interface Props { acoes: Acao[]; }

export function X1Checklist({ acoes }: Props) {
  const checks = useMemo(() => {
    const has = (fn: (a: Acao) => boolean) => acoes.some(fn);
    return [
      { label: "Gancho (msg inicial)", ok: acoes[0]?.tipo === "whatsapp" && (acoes[0]?.template || "").trim().length > 0 },
      { label: "Qualificação (IA ou pergunta)", ok: has(a => ["ia_message", "quick_reply", "input_capture", "ai_agent"].includes(a.tipo)) },
      { label: "Áudio / Prova social", ok: has(a => a.tipo === "audio" || (a.tipo === "whatsapp" && !!(a as any).media)) },
      { label: "CTA com link", ok: has(a => a.tipo === "whatsapp" && /\{\{link\}\}|https?:\/\//.test(a.template || "")) },
      { label: "Follow-up", ok: acoes.filter(a => a.tipo === "whatsapp").length >= 2 },
      { label: "Parada por compra", ok: has(a => a.tipo === "stop_on_event") },
    ];
  }, [acoes]);

  const done = checks.filter(c => c.ok).length;
  const total = checks.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-xl bg-slate-900/60 border border-white/5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
        Checklist X1 · {done}/{total} ({pct}%)
      </span>
      {checks.map((c, i) => (
        <div
          key={i}
          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
            c.ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-white/10 bg-white/5 text-muted-foreground"
          }`}
          title={c.ok ? "OK" : "Faltando"}
        >
          {c.ok ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
          {c.label}
        </div>
      ))}
    </div>
  );
}
