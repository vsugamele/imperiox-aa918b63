import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Key, Bell, Shield, Eye, EyeOff, AlertTriangle, Monitor } from "lucide-react";
import { toast } from "sonner";

export default function Configuracoes() {
  const { user } = useAuth();

  return (
    <div className="flex gap-6">
      {/* This uses tabs for navigation matching V5 sidebar look */}
      <Tabs defaultValue="apis" orientation="vertical" className="flex gap-6 w-full">
        <TabsList className="flex-col h-auto w-48 shrink-0 bg-transparent gap-0.5 justify-start items-stretch p-0">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4" /> Configurações
          </h2>
          <TabsTrigger value="apis" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Key className="h-3.5 w-3.5 mr-2" /> APIs & Keys
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Bell className="h-3.5 w-3.5 mr-2" /> Notificações
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Shield className="h-3.5 w-3.5 mr-2" /> Segurança
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-w-0">
          <TabsContent value="apis"><APIsTab /></TabsContent>
          <TabsContent value="notificacoes"><NotificacoesTab /></TabsContent>
          <TabsContent value="seguranca"><SegurancaTab user={user} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ── APIs & Keys Tab ──────────────────────────────────────────────
function APIsTab() {
  const API_SERVICES = [
    { key: "openrouter", label: "OpenRouter", desc: "Acessa Claude, GPT-4 e outros em um único lugar", icon: "🔀", prefix: "sk-or-v1-" },
    { key: "openai", label: "OpenAI", desc: "GPT-4o, GPT-4 Turbo", icon: "🟢", prefix: "sk-" },
    { key: "anthropic", label: "Anthropic", desc: "Claude 3.5 Sonnet / Haiku", icon: "🟠", prefix: "sk-ant-" },
    { key: "google_gemini", label: "Google Gemini", desc: "Gemini 2.0 Flash (fallback padrão)", icon: "🔵", prefix: "" },
    { key: "meta_ads", label: "Meta Ads", desc: "Token de acesso para anúncios", icon: "🟦", prefix: "EAAG" },
    { key: "hotmart", label: "Hotmart", desc: "Token de integração", icon: "🟧", prefix: "Bearer" },
    { key: "ticto", label: "Ticto", desc: "API Key", icon: "🟩", prefix: "tc_" },
    { key: "pushinpay", label: "PushinPay", desc: "Gateway de pagamento", icon: "✅", prefix: "push_" },
  ];

  const [keys, setKeys] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("imphq_api_keys");
    return saved ? JSON.parse(saved) : {};
  });
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  const save = () => {
    localStorage.setItem("imphq_api_keys", JSON.stringify(keys));
    toast.success("Chaves salvas!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">APIs & Chaves de Acesso</h2>
          <p className="text-xs text-muted-foreground">Armazenadas localmente e usadas em integrações</p>
        </div>
        <Button onClick={save} className="bg-primary">Salvar todas</Button>
      </div>

      <div className="space-y-3">
        {API_SERVICES.map((svc) => (
          <Card key={svc.key} className="bg-card border-border">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{svc.icon}</span>
                <div>
                  <p className="font-medium text-sm">{svc.label}</p>
                  <p className="text-[10px] text-muted-foreground">{svc.desc}</p>
                </div>
              </div>
              <div className="relative">
                <Input
                  type={visible[svc.key] ? "text" : "password"}
                  value={keys[svc.key] || ""}
                  onChange={e => setKeys({ ...keys, [svc.key]: e.target.value })}
                  placeholder={`${svc.prefix}...`}
                  className="bg-secondary pr-10"
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setVisible({ ...visible, [svc.key]: !visible[svc.key] })}
                >
                  {visible[svc.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Notificações Tab ─────────────────────────────────────────────
function NotificacoesTab() {
  const NOTIFICATIONS = [
    { key: "lead_capturado", label: "Novo Lead capturado", desc: "Notificação quando um novo lead é registrado" },
    { key: "nova_venda", label: "Nova venda realizada", desc: "Alerta de compra confirmada em algum produto" },
    { key: "tarefa_atribuida", label: "Novas tarefas atribuídas", desc: "Quando uma tarefa é atribuída para você" },
    { key: "relatorio_semanal", label: "Relatório semanal", desc: "Resumo de KPIs toda segunda-feira às 9h" },
    { key: "alertas_ia", label: "Alertas de IA", desc: "Oportunidades e insights gerados automaticamente" },
    { key: "atividade_equipe", label: "Atividade da equipe", desc: "Updates de membros em projetos que você segue" },
  ];

  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("imphq_notif_prefs");
    return saved ? JSON.parse(saved) : {
      lead_capturado: true, nova_venda: true, tarefa_atribuida: false,
      relatorio_semanal: true, alertas_ia: true, atividade_equipe: false,
    };
  });

  const toggle = (key: string) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem("imphq_notif_prefs", JSON.stringify(next));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Preferências de Notificação</h2>
      <div className="space-y-1">
        {NOTIFICATIONS.map(n => (
          <div key={n.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-medium">{n.label}</p>
              <p className="text-xs text-muted-foreground">{n.desc}</p>
            </div>
            <Switch checked={prefs[n.key]} onCheckedChange={() => toggle(n.key)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Segurança Tab ────────────────────────────────────────────────
function SegurancaTab({ user }: { user: any }) {
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });

  const changePassword = async () => {
    if (!passwords.newPass) { toast.error("Informe a nova senha"); return; }
    if (passwords.newPass !== passwords.confirm) { toast.error("Senhas não conferem"); return; }
    if (passwords.newPass.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    const { error } = await supabase.auth.updateUser({ password: passwords.newPass });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Senha atualizada!");
    setPasswords({ current: "", newPass: "", confirm: "" });
  };

  const signOutAll = async () => {
    await supabase.auth.signOut({ scope: "global" });
    toast.success("Desconectado de todos os dispositivos");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Segurança da Conta</h2>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm">Trocar Senha</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="password" placeholder="Senha atual" value={passwords.current} onChange={e => setPasswords({ ...passwords, current: e.target.value })} className="bg-secondary" />
          <Input type="password" placeholder="Nova senha" value={passwords.newPass} onChange={e => setPasswords({ ...passwords, newPass: e.target.value })} className="bg-secondary" />
          <Input type="password" placeholder="Confirmar nova senha" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} className="bg-secondary" />
          <Button onClick={changePassword} className="bg-primary">Atualizar senha</Button>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm">Sessões ativas</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">Dispositivos onde sua conta está conectada</p>
          <div className="flex items-center gap-3 p-2 rounded bg-secondary">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium">Sessão atual</p>
              <p className="text-[10px] text-muted-foreground">Chrome · {navigator.platform} · Ativa agora</p>
            </div>
            <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Zona de Perigo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Ações irreversíveis. Proceda com cuidado.</p>
          <Button variant="destructive" onClick={signOutAll}>Sair de todos os dispositivos</Button>
        </CardContent>
      </Card>
    </div>
  );
}
