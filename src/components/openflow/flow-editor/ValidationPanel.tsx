import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import type { FlowIssue } from "./validate";

interface Props {
  issues: FlowIssue[];
  onJump?: (stepIndex: number) => void;
}

export function ValidationPanel({ issues, onJump }: Props) {
  const [open, setOpen] = useState(false);
  const errors = issues.filter((i) => i.severity === "error");
  const warns = issues.filter((i) => i.severity === "warn");

  if (issues.length === 0) {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Fluxo válido
      </Badge>
    );
  }

  const tone =
    errors.length > 0
      ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/15"
      : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15";

  const Icon = errors.length > 0 ? AlertCircle : AlertTriangle;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={`h-7 gap-1.5 px-2 text-xs ${tone}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {errors.length > 0 && <span>{errors.length} erro{errors.length > 1 ? "s" : ""}</span>}
          {warns.length > 0 && (
            <span className="opacity-80">
              {errors.length > 0 ? " · " : ""}
              {warns.length} aviso{warns.length > 1 ? "s" : ""}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 max-h-96 overflow-y-auto bg-secondary/95 backdrop-blur p-2 text-sm leading-7"
      >
        <div className="px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">
          Problemas detectados
        </div>
        <ul className="space-y-1">
          {issues.map((it, idx) => {
            const ItIcon = it.severity === "error" ? AlertCircle : AlertTriangle;
            const itTone =
              it.severity === "error" ? "text-red-300" : "text-amber-300";
            return (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => {
                    if (it.stepIndex >= 0) onJump?.(it.stepIndex);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-white/5"
                >
                  <ItIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${itTone}`} />
                  <span className="flex-1 text-xs">{it.message}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
