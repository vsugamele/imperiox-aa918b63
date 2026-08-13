import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getPushStatus,
  isPreviewRuntime,
  isPushSupported,
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
  type PushStatus,
} from "@/lib/pushNotifications";

export function PushOptIn() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [status, setStatus] = useState<PushStatus>("unsupported");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ok = isPushSupported();
    setSupported(ok);
    if (!ok) return;

    getPushStatus().then((next) => {
      setStatus(next);
      setSubscribed(next === "subscribed");
    });
  }, []);

  const toggle = async () => {
    if (!supported) return;
    setLoading(true);
    try {
      if (subscribed) {
        await unsubscribeCurrentDevice();
        setSubscribed(false);
        setStatus("supported");
        toast.info("Notificacoes push desativadas neste dispositivo");
      } else {
        await subscribeCurrentDevice();
        setSubscribed(true);
        setStatus("subscribed");
        toast.success("Notificacoes push ativadas neste dispositivo");
      }
    } catch (err: any) {
      console.error("Push opt-in error:", err);
      const next = await getPushStatus();
      setStatus(next);
      setSubscribed(next === "subscribed");
      toast.error(err?.message || "Erro ao configurar push");
    } finally {
      setLoading(false);
    }
  };

  if (!supported || isPreviewRuntime()) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      disabled={loading || status === "denied"}
      className="h-10 w-10 md:h-8 md:w-8"
      title={subscribed ? "Desativar push neste dispositivo" : "Ativar notificacoes push"}
    >
      {subscribed ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
    </Button>
  );
}
