import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Bot,
  CheckCircle2,
  DollarSign,
  Flame,
  Send,
  ShoppingCart,
  Smartphone,
  Users,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPushStatus,
  isIOSDevice,
  isPreviewRuntime,
  isPushSupported,
  isStandalonePwa,
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
  type PushStatus,
} from "@/lib/pushNotifications";

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
  novo_lead: true,
  grupo_capacidade: true,
  disparo_concluido: true,
  erro_conexao: true,
  resposta_ia: false,
  venda_aprovada: true,
  venda_recusada: true,
  reembolso_solicitado: true,
  meta_diaria_atingida: true,
  hot_lead: true,
  checkout_abandonado: true,
  lead_inativo_voltou: false,
  expert_marcou_done: true,
  expert_subiu_video: true,
  expert_mensagem: true,
};

const ITEMS = [
  { key: "venda_aprovada" as const, label: "Venda aprovada", desc: "Toda venda confirmada vira push", icon: DollarSign, color: "text-emerald-400" },
  { key: "hot_lead" as const, label: "Pix/Boleto gerado", desc: "Lead com intencao de compra", icon: Flame, color: "text-orange-400" },
  { key: "checkout_abandonado" as const, label: "Checkout abandonado", desc: "Pix/Boleto gerado sem pagamento", icon: ShoppingCart, color: "text-amber-400" },
  { key: "novo_lead" as const, label: "Novo lead capturado", desc: "Formulario ou captura recebida", icon: Users, color: "text-emerald-400" },
  { key: "grupo_capacidade" as const, label: "Grupo atingiu capacidade", desc: "Grupo WhatsApp cheio", icon: Users, color: "text-amber-400" },
  { key: "disparo_concluido" as const, label: "Disparo concluido", desc: "Campanha enviada", icon: Send, color: "text-blue-400" },
  { key: "erro_conexao" as const, label: "Erro de conexao", desc: "WhatsApp ou integracao desconectou", icon: Wifi, color: "text-destructive" },
  { key: "resposta_ia" as const, label: "Resposta IA enviada", desc: "IA respondeu automaticamente", icon: Bot, color: "text-purple-400" },
];

export function NotificationPreferencesTab() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<PushStatus>("unsupported");
  const [pushBusy, setPushBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);

  const isPreview = typeof window !== "undefined" && isPreviewRuntime();
  const isIOS = typeof navigator !== "undefined" && isIOSDevice();
  const isStandalone = typeof window !== "undefined" && isStandalonePwa();

  const checkPush = useCallback(async () => {
    if (!isPushSupported()) {
      setPushStatus("unsupported");
      return;
    }
    setPushStatus(await getPushStatus());
  }, []);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("imphq_notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) setPrefs(data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    checkPush();
  }, [load, checkPush]);

  const enablePush = async () => {
    setPushBusy(true);
    try {
      await subscribeCurrentDevice();
      setPushStatus("subscribed");
      toast.success("Push ativado neste dispositivo");
    } catch (err: any) {
      setPushStatus(await getPushStatus());
      toast.error(err?.message || "Erro ao ativar push");
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushBusy(true);
    try {
      await unsubscribeCurrentDevice();
      setPushStatus("supported");
      toast.info("Push desativado neste dispositivo");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao desativar push");
    } finally {
      setPushBusy(false);
    }
  };

  const sendTest = async () => {
    setTestBusy(true);
    try {
      const { error } = await supabase.functions.invoke("send-push-test", { body: {} });
      if (error) throw error;
      toast.success("Teste enviado. Aguarde alguns segundos.");
    } catch (err: any) {
      toast.error(err?.message || "Erro no teste");
    } finally {
      setTestBusy(false);
    }
  };

  const toggle = async (field: keyof Prefs, value: boolean) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setPrefs((prev) => ({ ...prev, [field]: value }));

    if (prefs.id) {
      const { error } = await supabase.from("imphq_notification_preferences").update({ [field]: value } as any).eq("id", prefs.id);
      if (error) toast.error(error.message);
      return;
    }

    const { data, error } = await supabase
      .from("imphq_notification_preferences")
      .insert({ user_id: user.id, ...prefs, [field]: value } as any)
      .select()
      .single();

    if (error) toast.error(error.message);
    else setPrefs(data as any);
  };

  if (loading) return <p className="p-4 text-sm text-muted-foreground">Carregando...</p>;

  const statusCopy = {
    subscribed: "Push ativado neste dispositivo",
    supported: "Push desativado neste dispositivo",
    denied: "Permissao bloqueada pelo navegador",
    unsupported: "Navegador nao suporta push",
  }[pushStatus];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Bell className="h-5 w-5" /> Preferencias de notificacao
        </h2>
        <p className="text-xs text-muted-foreground">Configure os alertas e habilite push no aparelho atual.</p>
      </div>

      <Card className="border-primary/30">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            {pushStatus === "subscribed" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold">{statusCopy}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Push e por dispositivo. Ative separadamente no celular, desktop e outros navegadores.
              </p>
            </div>
          </div>

          {isPreview && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
              O preview/editor pode bloquear service worker. Para testar no celular, abra o dominio publicado diretamente no navegador.
            </div>
          )}

          {isIOS && !isStandalone && (
            <div className="flex items-start gap-2 rounded border border-blue-500/30 bg-blue-500/10 p-2 text-[11px] text-blue-200">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                iPhone/iPad: instale o app na tela de inicio pelo Safari antes de ativar push. Depois abra pelo icone instalado.
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {pushStatus === "supported" && (
              <Button size="sm" onClick={enablePush} disabled={pushBusy} className="gap-1">
                <Bell className="h-3.5 w-3.5" /> {pushBusy ? "Ativando..." : "Ativar neste aparelho"}
              </Button>
            )}
            {pushStatus === "subscribed" && (
              <>
                <Button size="sm" variant="outline" onClick={sendTest} disabled={testBusy} className="gap-1">
                  <Send className="h-3.5 w-3.5" /> {testBusy ? "Enviando..." : "Enviar teste"}
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
        {ITEMS.map((item) => (
          <Card key={item.key}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <item.icon className={`h-4 w-4 shrink-0 ${item.color}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <Switch checked={prefs[item.key]} onCheckedChange={(value) => toggle(item.key, value)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
