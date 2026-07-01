import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Target, Film, Mail, User, Zap, Compass } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assets?: Record<string, any> | null;
}

const SECTIONS: Array<{ key: string; label: string; icon: any }> = [
  { key: "avatar", label: "Avatar", icon: User },
  { key: "mecanismo_unico", label: "Mecanismo Único", icon: Zap },
  { key: "posicionamento", label: "Posicionamento", icon: Compass },
  { key: "angles", label: "Ângulos de Copy", icon: Target },
  { key: "vsl_outline", label: "Roteiro VSL", icon: Film },
  { key: "emails", label: "Sequência de E-mails", icon: Mail },
];

function renderValue(v: any) {
  if (v == null) return null;
  if (typeof v === "string") return <p className="text-sm whitespace-pre-wrap leading-7 text-foreground/90">{v}</p>;
  if (Array.isArray(v)) {
    return (
      <ul className="space-y-2">
        {v.map((item, i) => (
          <li key={i} className="text-sm border-l-2 border-primary/40 pl-3 leading-7">
            {typeof item === "string" ? item : <pre className="text-xs whitespace-pre-wrap font-mono">{JSON.stringify(item, null, 2)}</pre>}
          </li>
        ))}
      </ul>
    );
  }
  return <pre className="text-xs whitespace-pre-wrap font-mono bg-background/40 p-2 rounded">{JSON.stringify(v, null, 2)}</pre>;
}

export function PipelineAssetsDialog({ open, onOpenChange, assets }: Props) {
  const data = assets || {};
  const generatedAt = data.generated_at ? new Date(String(data.generated_at)).toLocaleString("pt-BR") : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] bg-secondary/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-5 w-5 text-primary" /> Ativos gerados pelo Pipeline IA
          </DialogTitle>
          <DialogDescription className="leading-7">
            {generatedAt ? `Gerado em ${generatedAt}` : "Copy, roteiros e inteligência produzidos junto com as etapas."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          {data.estrategia ? (
            <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs uppercase tracking-wider text-primary mb-1">Estratégia</p>
              <p className="text-sm leading-7">{String(data.estrategia)}</p>
            </div>
          ) : null}

          <div className="space-y-5">
            {SECTIONS.map(({ key, label, icon: Icon }) => {
              const v = data[key];
              const empty = v == null || (Array.isArray(v) && v.length === 0) || (typeof v === "string" && !v.trim());
              if (empty) return null;
              return (
                <div key={key} className="rounded-md border border-border/60 bg-background/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h4 className="font-display text-base">{label}</h4>
                    {Array.isArray(v) && <Badge variant="secondary" className="text-[10px]">{v.length}</Badge>}
                  </div>
                  {renderValue(v)}
                </div>
              );
            })}
            {SECTIONS.every(s => {
              const v = data[s.key];
              return v == null || (Array.isArray(v) && v.length === 0) || (typeof v === "string" && !v.trim());
            }) && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum ativo persistido ainda. Rode o Pipeline IA para gerar.</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
