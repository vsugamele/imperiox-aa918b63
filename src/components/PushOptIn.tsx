import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PushOptIn() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (ok && Notification.permission === "granted") {
      navigator.serviceWorker?.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setSubscribed(true);
        });
      });
    }
  }, []);

  const toggle = async () => {
    if (!supported) return;
    setLoading(true);
    try {
      if (subscribed) {
        const reg = await navigator.serviceWorker?.ready;
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("imphq_push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", sub.endpoint);
          }
        }
        setSubscribed(false);
        toast.info("Notificações push desativadas");
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          toast.error("Permissão de notificação negada");
          setLoading(false);
          return;
        }
        const reg = await navigator.serviceWorker?.ready;
        if (!reg) { setLoading(false); return; }

        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          toast.error("VAPID key não configurada");
          setLoading(false);
          return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });
        const json = sub.toJSON();
        const { data: { user } } = await supabase.auth.getUser();
        if (user && json.endpoint && json.keys) {
          await supabase.from("imphq_push_subscriptions").upsert({
            user_id: user.id,
            endpoint: json.endpoint,
            keys_p256dh: json.keys.p256dh || "",
            keys_auth: json.keys.auth || "",
          }, { onConflict: "user_id,endpoint" });
        }
        setSubscribed(true);
        toast.success("Notificações push ativadas!");
      }
    } catch (err) {
      console.error("Push opt-in error:", err);
      toast.error("Erro ao configurar push");
    }
    setLoading(false);
  };

  if (!supported) return null;

  const isPreview = window.location.hostname.includes("id-preview--") || window.location.hostname.includes("lovableproject.com");
  if (isPreview) return null;

  return (
    <Button variant="ghost" size="icon" onClick={toggle} disabled={loading} className="h-8 w-8" title={subscribed ? "Desativar push" : "Ativar notificações push"}>
      {subscribed ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
    </Button>
  );
}
