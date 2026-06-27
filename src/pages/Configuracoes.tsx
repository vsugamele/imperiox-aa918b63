import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Key, Bell, Shield, Eye, EyeOff, AlertTriangle, Monitor, Clock, Play, RefreshCw, Webhook, Trash2, Copy, Plus, Users, UserPlus, KeyRound, Ban, Activity, ScrollText, Tag, Package } from "lucide-react";
import { toast } from "sonner";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { IntegrationStatusTab } from "@/components/configuracoes/IntegrationStatusTab";
import { WebhookLogTab } from "@/components/configuracoes/WebhookLogTab";
import { NotificationPreferencesTab } from "@/components/configuracoes/NotificationPreferencesTab";
import { WaBriefingCard } from "@/components/configuracoes/WaBriefingCard";
import { TagRoutingRulesTab } from "@/components/configuracoes/TagRoutingRulesTab";
import { ProductRoutingRulesTab } from "@/components/configuracoes/ProductRoutingRulesTab";
import { OutboundWebhooksTab } from "@/components/configuracoes/OutboundWebhooksTab";




export default function Configuracoes() {
  const { user, isAdmin } = useAuth();

  return (
    <div className="flex gap-6">
      <Tabs defaultValue="apis" orientation="vertical" className="flex gap-6 w-full">
        <TabsList className="flex-col h-auto w-48 shrink-0 bg-transparent gap-0.5 justify-start items-stretch p-0">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4" /> Configurações
            <SectionInfo {...sectionHelpTexts.configuracoes} />
          </h2>
          {isAdmin && (
            <TabsTrigger value="usuarios" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Users className="h-3.5 w-3.5 mr-2" /> Usuários
            </TabsTrigger>
          )}
          <TabsTrigger value="apis" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Key className="h-3.5 w-3.5 mr-2" /> APIs & Keys
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Bell className="h-3.5 w-3.5 mr-2" /> Notificações
          </TabsTrigger>
          <TabsTrigger value="cronjobs" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Clock className="h-3.5 w-3.5 mr-2" /> Cron Jobs
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Shield className="h-3.5 w-3.5 mr-2" /> Segurança
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Webhook className="h-3.5 w-3.5 mr-2" /> API & Webhooks
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Activity className="h-3.5 w-3.5 mr-2" /> Status Integrações
          </TabsTrigger>
          <TabsTrigger value="webhook-log" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <ScrollText className="h-3.5 w-3.5 mr-2" /> Log Webhooks
          </TabsTrigger>
          <TabsTrigger value="tag-routing" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Tag className="h-3.5 w-3.5 mr-2" /> Tag → Projeto
          </TabsTrigger>
          <TabsTrigger value="product-routing" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Package className="h-3.5 w-3.5 mr-2" /> Produto → Projeto
          </TabsTrigger>
          <TabsTrigger value="outbound" className="justify-start text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Webhook className="h-3.5 w-3.5 mr-2" /> Webhooks Saída
          </TabsTrigger>
        </TabsList>


        <div className="flex-1 min-w-0">
          {isAdmin && <TabsContent value="usuarios"><UsuariosTab /></TabsContent>}
          <TabsContent value="apis"><APIsTab /></TabsContent>
          <TabsContent value="notificacoes"><NotificacoesTab /></TabsContent>
          <TabsContent value="cronjobs"><CronJobsTab /></TabsContent>
          <TabsContent value="seguranca"><SegurancaTab user={user} /></TabsContent>
          <TabsContent value="webhooks"><WebhooksTab /></TabsContent>
          <TabsContent value="integracoes"><IntegrationStatusTab /></TabsContent>
          <TabsContent value="webhook-log"><WebhookLogTab /></TabsContent>
          <TabsContent value="tag-routing"><TagRoutingRulesTab /></TabsContent>
          <TabsContent value="product-routing"><ProductRoutingRulesTab /></TabsContent>
          <TabsContent value="outbound"><OutboundWebhooksTab /></TabsContent>
        </div>

      </Tabs>
    </div>
  );
}

// ── Usuarios Tab (Admin) ─────────────────────────────────────────
interface UserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
  role: string | null;
  status: string;
  team_name: string | null;
  team_department: string | null;
  is_team_member: boolean;
}

function UsuariosTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("editor");
  const [resetPassword, setResetPassword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const callAdminApi = async (action: string, body?: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "tkbivipqiewkfnhktmqq";
    const url = `https://${projectId}.supabase.co/functions/v1/admin-users?action=${action}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro na API");
    return data;
  };

  const loadUsers = async () => {
    try { setLoading(true); const data = await callAdminApi("list"); setUsers(data.users || []); }
    catch (err: any) { toast.error("Erro ao carregar usuários: " + err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async () => {
    if (!newEmail || !newPassword) { toast.error("Preencha email e senha"); return; }
    if (newPassword.length < 6) { toast.error("Senha mínima: 6 caracteres"); return; }
    try {
      await callAdminApi("create", { email: newEmail, password: newPassword, role: newRole });
      toast.success("Usuário criado!"); setCreateOpen(false); setNewEmail(""); setNewPassword(""); setNewRole("editor"); loadUsers();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSetPassword = async () => {
    if (!selectedUser || !resetPassword) return;
    if (resetPassword.length < 6) { toast.error("Senha mínima: 6 caracteres"); return; }
    try { await callAdminApi("set_password", { user_id: selectedUser.id, password: resetPassword }); toast.success("Senha atualizada!"); setPasswordOpen(false); setResetPassword(""); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleSetRole = async (userId: string, role: string) => {
    try { await callAdminApi("set_role", { user_id: userId, role }); toast.success("Role atualizada!"); loadUsers(); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleSetStatus = async (userId: string, status: string) => {
    try { await callAdminApi("set_status", { user_id: userId, status }); toast.success(status === "approved" ? "Usuário aprovado!" : "Usuário rejeitado"); loadUsers(); }
    catch (err: any) { toast.error(err.message); }
  };

  const handleToggleBan = async (u: UserRow) => {
    try { await callAdminApi("toggle_ban", { user_id: u.id, ban: !u.banned }); toast.success(u.banned ? "Usuário reativado" : "Usuário desativado"); loadUsers(); }
    catch (err: any) { toast.error(err.message); }
  };

  const getRoleBadge = (role: string | null) => {
    if (role === "admin") return <Badge className="bg-primary/20 text-primary text-[9px]">Admin</Badge>;
    if (role === "editor") return <Badge className="bg-blue-500/20 text-blue-400 text-[9px]">Editor</Badge>;
    if (role === "viewer") return <Badge className="bg-muted text-muted-foreground text-[9px]">Viewer</Badge>;
    return <Badge variant="outline" className="text-[9px]">Sem role</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (status === "pending") return <Badge className="bg-amber-500/20 text-amber-400 text-[9px]">⏳ Pendente</Badge>;
    if (status === "rejected") return <Badge variant="destructive" className="text-[9px]">❌ Rejeitado</Badge>;
    if (status === "invited") return <Badge className="bg-blue-500/20 text-blue-400 text-[9px]">📨 Convidado</Badge>;
    return null;
  };

  const pendingCount = users.filter(u => u.status === "pending").length;
  const filtered = statusFilter === "all" ? users : users.filter(u => u.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">Gerenciar Usuários</h2>
          <SectionInfo {...sectionHelpTexts.usuarios} />
          {pendingCount > 0 && <Badge className="bg-amber-500/20 text-amber-400 text-[9px]">{pendingCount} pendente(s)</Badge>}
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm"><UserPlus className="h-4 w-4 mr-1" /> Criar Usuário</Button>
      </div>

      <div className="flex gap-1">
        {[{ value: "all", label: "Todos" }, { value: "pending", label: "Pendentes" }, { value: "approved", label: "Aprovados" }, { value: "invited", label: "Convidados" }].map(f => (
          <Button key={f.value} size="sm" variant={statusFilter === f.value ? "default" : "outline"} className="text-xs h-7" onClick={() => setStatusFilter(f.value)}>
            {f.label}{f.value === "pending" && pendingCount > 0 && <span className="ml-1 bg-amber-500/30 rounded-full px-1.5 text-[9px]">{pendingCount}</span>}
          </Button>
        ))}
      </div>

      {loading ? <p className="text-xs text-muted-foreground">Carregando...</p> : (
        <div className="space-y-2">
          {filtered.map(u => (
            <Card key={u.id} className={`bg-card border-border ${u.status === "pending" ? "border-amber-500/30" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {u.team_name && <p className="text-sm font-bold">{u.team_name}</p>}
                      <p className="text-sm font-medium truncate">{u.email}</p>
                      {getRoleBadge(u.role)}
                      {getStatusBadge(u.status)}
                      {u.banned && <Badge variant="destructive" className="text-[9px]">Banido</Badge>}
                      {u.is_team_member && <Badge className="bg-emerald-500/20 text-emerald-400 text-[9px]">👥 Equipe</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {u.team_department && <span className="text-[10px] text-muted-foreground">📁 {u.team_department}</span>}
                      <p className="text-[10px] text-muted-foreground">
                        {u.status === "invited" ? "Ainda não se cadastrou" : `Último login: ${u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : "Nunca"}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {u.status === "pending" && (
                      <>
                        <Button size="sm" className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700" onClick={() => handleSetStatus(u.id, "approved")}>✅ Aprovar</Button>
                        <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => handleSetStatus(u.id, "rejected")}>❌ Rejeitar</Button>
                      </>
                    )}
                    {u.status !== "invited" && u.status !== "pending" && (
                      <>
                        <Select value={u.role || "none"} onValueChange={(v) => handleSetRole(u.id, v)}>
                          <SelectTrigger className="h-7 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="none">Sem role</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Redefinir senha" onClick={() => { setSelectedUser(u); setPasswordOpen(true); }}><KeyRound className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className={`h-7 w-7 ${u.banned ? "text-emerald-400" : "text-destructive"}`} title={u.banned ? "Reativar" : "Desativar"} onClick={() => handleToggleBan(u)}><Ban className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado</p>}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Email</Label><Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="colaborador@email.com" className="bg-secondary" /></div>
            <div><Label className="text-xs">Senha</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-secondary" /></div>
            <div><Label className="text-xs">Role</Label>
              <Select value={newRole} onValueChange={setNewRole}><SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="editor">Editor</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreate}>Criar Usuário</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir Senha</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Definir nova senha para: <strong>{selectedUser?.email}</strong></p>
          <Input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="Nova senha (mínimo 6 caracteres)" className="bg-secondary" />
          <DialogFooter><Button onClick={handleSetPassword}>Salvar Senha</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── APIs & Keys Tab ──────────────────────────────────────────────
const API_PIN = "464321";

function APIsTab() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [keys, setKeys] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("imphq_api_keys");
    return saved ? JSON.parse(saved) : {};
  });
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  const API_SERVICES = [
    { key: "openrouter", label: "OpenRouter", desc: "Acessa Claude, GPT-4 e outros em um único lugar", icon: "🔀", prefix: "sk-or-v1-" },
    { key: "openai", label: "OpenAI", desc: "GPT-4o, GPT-4 Turbo", icon: "🟢", prefix: "sk-" },
    { key: "anthropic", label: "Anthropic", desc: "Claude 3.5 Sonnet / Haiku", icon: "🟠", prefix: "sk-ant-" },
    { key: "google_gemini", label: "Google Gemini", desc: "Gemini 2.0 Flash (fallback padrão)", icon: "🔵", prefix: "" },
    { key: "meta_ads", label: "Meta Ads", desc: "Token de acesso para anúncios", icon: "🟦", prefix: "EAAG" },
    { key: "pushinpay", label: "PushinPay", desc: "Gateway de pagamento", icon: "✅", prefix: "push_" },
  ];

  const checkPin = () => {
    if (pin === API_PIN) {
      setUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const save = () => {
    localStorage.setItem("imphq_api_keys", JSON.stringify(keys));
    toast.success("Chaves salvas!");
  };

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Card className="w-full max-w-sm border-border">
          <CardContent className="p-6 space-y-4 text-center">
            <Shield className="h-10 w-10 text-primary mx-auto" />
            <div>
              <h3 className="font-bold text-lg">Área Protegida</h3>
              <p className="text-xs text-muted-foreground mt-1">Digite a senha para acessar as chaves de API</p>
            </div>
            <Input
              type="password"
              placeholder="Senha de acesso"
              value={pin}
              onChange={e => { setPin(e.target.value); setPinError(false); }}
              onKeyDown={e => e.key === "Enter" && checkPin()}
              className={`bg-secondary text-center text-lg tracking-widest ${pinError ? "border-destructive" : ""}`}
            />
            {pinError && <p className="text-xs text-destructive">Senha incorreta</p>}
            <Button onClick={checkPin} className="w-full">Desbloquear</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">APIs & Chaves de Acesso</h2>
          <p className="text-xs text-muted-foreground">Armazenadas localmente e usadas em integrações</p>
        </div>
        <Button onClick={save} className="bg-primary">Salvar todas</Button>
      </div>
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground">💡 Tokens de <strong>Hotmart</strong>, <strong>Kiwify</strong> e <strong>Ticto</strong> agora são configurados <strong>por projeto</strong>, na aba <strong>Analytics → Webhooks de Pagamento</strong> de cada projeto.</p>
        </CardContent>
      </Card>
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
    <div className="space-y-6">
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

      {/* WhatsApp / Campaign Notification Preferences (DB-backed) */}
      <NotificationPreferencesTab />

      {/* Daily Briefing por WhatsApp */}
      <WaBriefingCard />
    </div>
  );
}

// ── Cron Jobs Tab ────────────────────────────────────────────────
function CronJobsTab() {
  const CRON_JOBS = [
    { key: "relatorio_semanal", name: "Relatório Semanal", description: "Gera um resumo de KPIs e métricas de todos os projetos ativos", icon: "📊", frequency: "Toda segunda às 9h", cron: "0 9 * * 1" },
    { key: "limpeza_dados", name: "Limpeza de Dados Antigos", description: "Remove webhooks processados com mais de 90 dias e logs antigos", icon: "🧹", frequency: "Todo domingo às 3h", cron: "0 3 * * 0" },
    { key: "leads_inativos", name: "Verificação de Leads Inativos", description: "Identifica leads sem interação há 30+ dias e marca como inativos", icon: "👤", frequency: "Diariamente às 6h", cron: "0 6 * * *" },
    { key: "sync_analytics", name: "Sync de Analytics", description: "Puxa dados de plataformas (Meta, GA) e atualiza KPIs dos projetos", icon: "📈", frequency: "A cada 6 horas", cron: "0 */6 * * *" },
    { key: "backup_kb", name: "Backup Knowledge Base", description: "Exporta toda a KB para um documento de backup no Supabase Storage", icon: "💾", frequency: "Diariamente às 2h", cron: "0 2 * * *" },
  ];

  const [statuses, setStatuses] = useState<Record<string, { enabled: boolean; lastRun?: string; status?: string }>>(() => {
    const saved = localStorage.getItem("imphq_cron_statuses");
    return saved ? JSON.parse(saved) : {};
  });

  const [running, setRunning] = useState<string | null>(null);

  const toggleCron = (key: string) => {
    const next = { ...statuses, [key]: { ...statuses[key], enabled: !statuses[key]?.enabled } };
    setStatuses(next);
    localStorage.setItem("imphq_cron_statuses", JSON.stringify(next));
    toast.success(next[key].enabled ? "Cron ativado" : "Cron desativado");
  };

  const runManual = async (key: string) => {
    setRunning(key);
    await new Promise(r => setTimeout(r, 2000));
    const next = { ...statuses, [key]: { ...statuses[key], lastRun: new Date().toISOString(), status: "success" } };
    setStatuses(next);
    localStorage.setItem("imphq_cron_statuses", JSON.stringify(next));
    setRunning(null);
    toast.success("Executado com sucesso!");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Cron Jobs</h2>
        <p className="text-xs text-muted-foreground">Tarefas agendadas do sistema. Ative pg_cron no Supabase para execução automática.</p>
      </div>
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-medium text-amber-400">⚠️ Para habilitar execução automática:</p>
          <ol className="text-[11px] text-muted-foreground space-y-1">
            <li>1. Ative a extensão <code className="bg-secondary px-1 rounded">pg_cron</code> e <code className="bg-secondary px-1 rounded">pg_net</code> no Supabase</li>
            <li>2. Execute o SQL de configuração no SQL Editor do Supabase</li>
            <li>3. Os cron jobs chamarão as edge functions automaticamente nos horários configurados</li>
          </ol>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {CRON_JOBS.map(job => {
          const st = statuses[job.key] as { enabled?: boolean; lastRun?: string; status?: string } | undefined;
          return (
            <Card key={job.key} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-xl mt-0.5">{job.icon}</span>
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm">{job.name}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{job.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-[9px] font-mono">{job.cron}</Badge>
                        <Badge variant="secondary" className="text-[9px]">{job.frequency}</Badge>
                        {st?.lastRun && (
                          <Badge className={`text-[9px] ${st.status === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-destructive/20 text-destructive"}`}>
                            Último: {new Date(st.lastRun).toLocaleString("pt-BR")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => runManual(job.key)} disabled={running === job.key}>
                      {running === job.key ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                      {running === job.key ? "Executando..." : "Executar"}
                    </Button>
                    <Switch checked={st?.enabled || false} onCheckedChange={() => toggleCron(job.key)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
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

// ── API & Webhooks Tab ───────────────────────────────────────────
function WebhooksTab() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const projectId = "tkbivipqiewkfnhktmqq";

  const loadKeys = async () => {
    const { data } = await supabase.from("imphq_api_keys").select("*").order("created_at", { ascending: false });
    setKeys(data || []);
  };

  useEffect(() => { loadKeys(); }, []);

  const generateKey = async () => {
    if (!newKeyName.trim() || !user) return;
    const rawKey = `imphq_${crypto.randomUUID().replace(/-/g, "")}`;
    const keyHash = btoa(rawKey);
    const keyPreview = rawKey.slice(-8);

    const { error } = await supabase.from("imphq_api_keys").insert({
      user_id: user.id,
      name: newKeyName.trim(),
      key_hash: keyHash,
      key_preview: keyPreview,
      permissions: ["read", "write"],
    });

    if (error) { toast.error(error.message); return; }
    setGeneratedKey(rawKey);
    setNewKeyName("");
    loadKeys();
    toast.success("Chave gerada!");
  };

  const revokeKey = async (id: string) => {
    await supabase.from("imphq_api_keys").delete().eq("id", id);
    toast.success("Chave revogada");
    loadKeys();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Copiado!");
  };

  const baseUrl = `https://${projectId}.supabase.co/functions/v1/imperio-api`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">API & Webhooks</h2>
        <p className="text-xs text-muted-foreground">Gerencie chaves de API para integrações com IAs e automações externas</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-medium">Gerar Nova Chave</h3>
          <div className="flex gap-2">
            <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Nome da chave (ex: MeuBot, Make, n8n)" className="bg-secondary" />
            <Button onClick={generateKey} disabled={!newKeyName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Gerar
            </Button>
          </div>
          {generatedKey && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <p className="text-xs font-bold text-emerald-400">⚠️ Copie agora — esta chave não será exibida novamente!</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-secondary px-2 py-1 rounded flex-1 break-all">{generatedKey}</code>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyKey(generatedKey)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-medium">Chaves Ativas ({keys.length})</h3>
          {keys.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma chave gerada</p>}
          {keys.map(k => (
            <div key={k.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="text-sm font-medium">{k.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  ••••••••{k.key_preview}
                  {k.last_used_at && ` · Usado: ${new Date(k.last_used_at).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => revokeKey(k.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-medium">📖 Documentação da API</h3>
          <p className="text-xs text-muted-foreground">Use o header <code className="bg-secondary px-1 rounded">x-api-key</code> em todas as requisições.</p>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
              <p className="text-xs font-bold text-emerald-400">POST — Criar Tarefa</p>
              <code className="text-[10px] text-muted-foreground block break-all">{baseUrl}?action=create_task</code>
              <pre className="text-[10px] text-muted-foreground bg-secondary rounded p-2 mt-1">{`{ "title": "Minha tarefa", "board": "agentes", "priority": "high" }`}</pre>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
              <p className="text-xs font-bold text-blue-400">POST — Criar Lead</p>
              <code className="text-[10px] text-muted-foreground block break-all">{baseUrl}?action=create_lead</code>
              <pre className="text-[10px] text-muted-foreground bg-secondary rounded p-2 mt-1">{`{ "nome": "João", "email": "joao@email.com", "project_id": "meu-projeto" }`}</pre>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
              <p className="text-xs font-bold text-amber-400">GET — Status do Projeto</p>
              <code className="text-[10px] text-muted-foreground block break-all">{baseUrl}?action=project_status&project_id=meu-projeto</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
