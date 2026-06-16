import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Users, Send, Wifi, Bot, CheckCircle2, AlertTriangle, Smartphone, ExternalLink, DollarSign, Flame, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BLSx5jJeDYyBAq6dIN18oTfD0sv8JjSWGeQ0N8z0P74SJLrRcO_DMDFh9oPP5Yf0t0F-ZlciudxgCigyLQ3Toyo";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

interface Prefs {
  id?: string;
  novo_lead: boolean;
  grupo_capacidade: boolean;
  disparo_concluido: boolean;
  erro_conexao: boolean;
  resposta_ia: boolean;
  venda_aprovada: boolean;
  venda_recusada: boolean;
  reembolso_solicitado: boolean;
  meta_diaria_atingida: boolean;
  hot_lead: boolean;
  checkout_abandonado: boolean;
  lead_inativo_voltou: boolean;
  expert_marcou_done: boolean;
  expert_subiu_video: boolean;
  expert_mensagem: boolean;
}

const DEFAULT_PREFS: Prefs = {
  novo_lead: true, grupo_capacidade: true, disparo_concluido: true, erro_conexao: true, resposta_ia: false,
  venda_aprovada: true, venda_recusada: true, reembolso_solicitado: true, meta_diaria_atingida: true,
  hot_lead: true, checkout_abandonado: true, lead_inativo_voltou: false, expert_marcou_done: true, expert_subiu_video: true, expert_mensagem: true,
};

export function NotificationPreferencesTab() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<"unknown" | "supported" | "denied" | "subscribed" | "unsupported">("unknown");
  const [pushBusy, setPushBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);

  const isPreviewDomain = typeof window !== "undefined" && (window.location.hostname.includes("id-preview--") || window.location.hostname.includes("lovableproject.com"));
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone);

  const checkPush = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushStatus("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushStatus(sub ? "subscribed" : "supported");
    } catch {
      setPushStatus("supported");
    }
  }, []);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("imphq_notification_preferences").select("*").eq("user_id", user.id).maybeSingle();
    if (data) setPrefs(data as any);
    setLoading(false);
  }, []);

  useEffect(() => { load(); checkPush(); }, [load, checkPush]);

  const enablePush = async () => {
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Permissão negada. Habilite nas configurações do navegador.");
        setPushBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) || VAPID_PUBLIC_KEY;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      const json = sub.toJSON();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && json.endpoint && json.keys) {
        await supabase.from("imphq_push_subscriptions").upsert({
          user_id: user.id, endpoint: json.endpoint,
          keys_p256dh: json.keys.p256dh || "", keys_auth: json.keys.auth || "",
        }, { onConflict: "user_id,endpoint" });
      }
      toast.success("Push ativado neste dispositivo!");
      setPushStatus("subscribed");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao ativar push: " + (err?.message || "desconhecido"));
    }
    setPushBusy(false);
  };

  const disablePush = async () => {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from("imphq_push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", sub.endpoint);
      }
      toast.info("Push desativado");
      setPushStatus("supported");
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || ""));
    }
    setPushBusy(false);
  };

  const sendTest = async () => {
    setTestBusy(true);
    try {
      const { error } = await supabase.functions.invoke("send-push-test", { body: {} });
      if (error) throw error;
      toast.success("Teste enviado! Aguarde a notificação chegar (até 30s).");
    } catch (err: any) {
      toast.error("Erro no teste: " + (err?.message || ""));
    }
    setTestBusy(false);
  };

  const toggle = async (field: keyof Prefs, value: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setPrefs(prev => ({ ...prev, [field]: value }));
    if (prefs.id) {
      const { error } = await supabase.from("imphq_notification_preferences").update({ [field]: value } as any).eq("id", prefs.id);
      if (error) toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("imphq_notification_preferences").insert({ user_id: user.id, ...prefs, [field]: value } as any).select().single();
      if (error) toast.error(error.message);
      else setPrefs(data as any);
    }
  };

  const items = [
    { key: "venda_aprovada" as const, label: "Venda aprovada 💰", desc: "Toda venda confirmada (Pix/Cartão/Boleto) vira push", icon: DollarSign, color: "text-emerald-400" },
    { key: "hot_lead" as const, label: "Pix/Boleto gerado (hot lead) 🔥", desc: "Lead com intenção de compra — carrinho quente", icon: Flame, color: "text-orange-400" },
    { key: "checkout_abandonado" as const, label: "Checkout abandonado 🛒", desc: "Pix/Boleto gerado há +30min sem pagamento", icon: ShoppingCart, color: "text-amber-400" },
    { key: "novo_lead" as const, label: "Novo lead capturado 🎯", desc: "Alerta instantâneo quando um lead preenche um form", icon: Users, color: "text-emerald-400" },
    { key: "grupo_capacidade" as const, label: "Grupo atingiu capacidade", desc: "Alerta quando grupo WhatsApp está cheio", icon: Users, color: "text-amber-400" },
    { key: "disparo_concluido" as const, label: "Disparo concluído", desc: "Notificação após envio de campanha", icon: Send, color: "text-blue-400" },
    { key: "erro_conexao" as const, label: "Erro de conexão", desc: "Alerta quando o WhatsApp desconectar", icon: Wifi, color: "text-destructive" },
    { key: "resposta_ia" as const, label: "Resposta IA enviada", desc: "Notificação quando IA responder automaticamente", icon: Bot, color: "text-purple-400" },
  ];

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><Bell className="h-5 w-5" /> Preferências de Notificação</h2>
        <p className="text-xs text-muted-foreground">Configure quais alertas você deseja receber</p>
      </div>

      {/* Push status card */}
      <Card className="border-primary/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {pushStatus === "subscribed" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {pushStatus === "subscribed" && "✅ Push ativado neste dispositivo"}
                  {pushStatus === "supported" && "❌ Push desativado neste dispositivo"}
                  {pushStatus === "denied" && "🚫 Permissão bloqueada pelo navegador"}
                  {pushStatus === "unsupported" && "⚠️ Navegador não suporta push"}
                  {pushStatus === "unknown" && "Verificando..."}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Para receber alertas no celular, ative push em cada dispositivo (mobile + desktop).
                </p>
              </div>
            </div>
          </div>

          {isPreviewDomain && (
            <div className="text-[11px] bg-amber-500/10 border border-amber-500/30 rounded p-2 text-amber-200 flex items-start gap-2">
              <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                Você está no preview. Para ativar push no celular, abra <strong>https://imperiox.lovable.app</strong> diretamente no Chrome/Safari do smartphone.
              </span>
            </div>
          )}

          {isIOS && !isStandalone && (
            <div className="text-[11px] bg-blue-500/10 border border-blue-500/30 rounded p-2 text-blue-200 flex items-start gap-2">
              <Smartphone className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                <strong>iPhone/iPad:</strong> push só funciona se você instalar o app na tela de início. Abra no Safari → Compartilhar → "Adicionar à Tela de Início" → abra pelo ícone instalado.
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {pushStatus === "supported" && (
              <Button size="sm" onClick={enablePush} disabled={pushBusy} className="gap-1">
                <Bell className="h-3.5 w-3.5" /> {pushBusy ? "Ativando..." : "Ativar agora"}
              </Button>
            )}
            {pushStatus === "subscribed" && (
              <>
                <Button size="sm" variant="outline" onClick={sendTest} disabled={testBusy} className="gap-1">
                  <Send className="h-3.5 w-3.5" /> {testBusy ? "Enviando..." : "Enviar notificação de teste"}
                </Button>
                <Button size="sm" variant="ghost" onClick={disablePush} disabled={pushBusy} className="gap-1">
                  <BellOff className="h-3.5 w-3.5" /> Desativar
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.map(item => (
          <Card key={item.key}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <item.icon className={`h-4 w-4 ${item.color} shrink-0`} />
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <Switch checked={prefs[item.key]} onCheckedChange={v => toggle(item.key, v)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
