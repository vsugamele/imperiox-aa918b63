import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Bell, Users, Send, Wifi, Bot, DollarSign, XCircle, RotateCcw, Target, Flame, UserCheck, CheckCircle2, Video, MessageSquare } from "lucide-react";
import { toast } from "sonner";

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
  lead_inativo_voltou: false,
  expert_marcou_done: true,
  expert_subiu_video: true,
  expert_mensagem: true,
};

export function NotificationPreferencesTab() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("imphq_notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setPrefs(data as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (field: keyof Prefs, value: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setPrefs(prev => ({ ...prev, [field]: value }));

    if (prefs.id) {
      const { error } = await supabase
        .from("imphq_notification_preferences")
        .update({ [field]: value } as any)
        .eq("id", prefs.id);
      if (error) toast.error(error.message);
    } else {
      const { data, error } = await supabase
        .from("imphq_notification_preferences")
        .insert({ user_id: user.id, ...prefs, [field]: value } as any)
        .select()
        .single();
      if (error) toast.error(error.message);
      else setPrefs(data as any);
    }
  };

  const items = [
    { key: "novo_lead" as const, label: "Novo lead detectado", desc: "Receba alerta quando um novo lead chegar", icon: Users, color: "text-emerald-400" },
    { key: "grupo_capacidade" as const, label: "Grupo atingiu capacidade", desc: "Alerta quando grupo WhatsApp está cheio", icon: Users, color: "text-amber-400" },
    { key: "disparo_concluido" as const, label: "Disparo concluído", desc: "Notificação após envio de campanha", icon: Send, color: "text-blue-400" },
    { key: "erro_conexao" as const, label: "Erro de conexão", desc: "Alerta quando o WhatsApp desconectar", icon: Wifi, color: "text-destructive" },
    { key: "resposta_ia" as const, label: "Resposta IA enviada", desc: "Notificação quando IA responder automaticamente", icon: Bot, color: "text-purple-400" },
  ];

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Bell className="h-5 w-5" /> Preferências de Notificação
        </h2>
        <p className="text-xs text-muted-foreground">Configure quais alertas você deseja receber</p>
      </div>

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
              <Switch
                checked={prefs[item.key]}
                onCheckedChange={v => toggle(item.key, v)}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
