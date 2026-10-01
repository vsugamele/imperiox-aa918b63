import { Camera, Monitor, Smartphone } from "lucide-react";
import { Label } from "@/components/ui/label";
import { objectFields } from "@/lib/json-fields";

interface StepPrintsProps {
  nodeId: string;
  label: string;
  printMeta: unknown;
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

/** Prints automáticos da página da etapa (scripts/map-prints.mjs): computador, celular e data. */
export function StepPrints({ nodeId, label, printMeta }: StepPrintsProps) {
  const meta = objectFields(printMeta);
  const desktop = text(meta.desktop);
  const mobile = text(meta.mobile);
  const capturedAt = text(meta.captured_at);
  const error = text(meta.error);
  const open = (url: string) => window.dispatchEvent(new CustomEvent("open-image-lightbox", { detail: { url, label } }));

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Label className="flex items-center gap-1 text-xs"><Camera className="h-3.5 w-3.5" /> Prints da página</Label>
      {desktop || mobile ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          {desktop && (
            <button type="button" onClick={() => open(desktop)} className="overflow-hidden rounded border border-border text-left" title="Ampliar print de computador">
              <img src={desktop} alt={`Print de computador de ${label}`} className="aspect-[16/10] w-full object-cover object-top" />
              <span className="flex items-center gap-1 px-1.5 py-1 text-[11px] text-muted-foreground"><Monitor className="h-3 w-3" /> Computador</span>
            </button>
          )}
          {mobile && (
            <button type="button" onClick={() => open(mobile)} className="w-24 overflow-hidden rounded border border-border text-left" title="Ampliar print de celular">
              <img src={mobile} alt={`Print de celular de ${label}`} className="aspect-[9/16] w-full object-cover object-top" />
              <span className="flex items-center gap-1 px-1.5 py-1 text-[11px] text-muted-foreground"><Smartphone className="h-3 w-3" /> Celular</span>
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Ainda sem print desta página.</p>
      )}
      {capturedAt && <p className="text-[11px] text-muted-foreground">Tirado em {new Date(capturedAt).toLocaleString("pt-BR")}</p>}
      {error && <p className="text-[11px] text-destructive">Último print falhou: {error}</p>}
      <p className="text-[11px] text-subtle">
        Atualizar: <code className="font-mono">node scripts/map-prints.mjs --node {nodeId}</code>
      </p>
    </div>
  );
}
