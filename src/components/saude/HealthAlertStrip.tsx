import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";
import { useSystemHealth } from "@/lib/system-health";

/** Faixa no topo do /hoje: só aparece quando algo crítico está quebrado. */
export function HealthAlertStrip() {
  const { data } = useSystemHealth();
  const failing = (data?.checks ?? []).filter((c) => c.status === "fail");
  if (failing.length === 0) return null;
  const names = failing.slice(0, 3).map((c) => c.label).join(" · ");
  return (
    <Link
      to="/saude"
      className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500 hover:bg-red-500/15"
      data-testid="health-alert-strip"
    >
      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>
        <strong>{failing.length} coisa(s) quebrada(s) no sistema:</strong> {names}
        {failing.length > 3 && ` e mais ${failing.length - 3}`}. Ver o que fazer →
      </span>
    </Link>
  );
}
