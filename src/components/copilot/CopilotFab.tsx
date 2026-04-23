import { useState } from "react";
import { Crown } from "lucide-react";
import { CopilotPanel } from "./CopilotPanel";
import { cn } from "@/lib/utils";

export function CopilotFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl",
          "flex items-center justify-center transition-all hover:scale-110 hover:shadow-[0_0_30px_hsl(var(--primary)/0.5)]",
          "border-2 border-primary/40"
        )}
        aria-label="Abrir Imperius"
        title="Imperius — copiloto estratégico"
      >
        <Crown className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-400 rounded-full animate-pulse" />
      </button>
      <CopilotPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
