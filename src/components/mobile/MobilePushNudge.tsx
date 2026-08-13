import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getPushStatus,
  isPreviewRuntime,
  isPushSupported,
  subscribeCurrentDevice,
  type PushStatus,
} from "@/lib/pushNotifications";

const DISMISSED_KEY = "imphq.mobilePushNudge.dismissed";

export function MobilePushNudge() {
  const [status, setStatus] = useState<PushStatus>("unsupported");
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported() || isPreviewRuntime()) return;
    getPushStatus().then(setStatus);
  }, []);

  const activate = async () => {
    setBusy(true);
    try {
      await subscribeCurrentDevice();
      setStatus("subscribed");
      toast.success("Notificacoes ativadas neste celular");
    } catch (err: any) {
      setStatus(await getPushStatus());
      toast.error(err?.message || "Erro ao ativar notificacoes");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  if (dismissed || status !== "supported") return null;

  return (
    <div className="md:hidden border-b border-border/60 bg-secondary/70 px-3 py-2">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-xs text-foreground">Receber alertas deste celular</p>
        <Button size="sm" className="h-8 px-3 text-xs" onClick={activate} disabled={busy}>
          {busy ? "..." : "Ativar"}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={dismiss} aria-label="Dispensar">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
