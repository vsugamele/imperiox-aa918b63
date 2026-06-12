import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Instagram, CheckCircle2, XCircle, ExternalLink, Copy, RefreshCw,
  Eye, EyeOff, AlertCircle, Loader2, Bot, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";

const WEBHOOK_URL = (projectId: string) =>
  `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/instagram-webhook?project=${projectId}`;

const ZERNIO_WEBHOOK_URL = (projectId: string) =>
  `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/zernio-webhook?project=${projectId}`;

interface Props { projectId: string }

export function ProjetoInstagram({ projectId }: Props) {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  // Form Meta
  const [accessToken, setAccessToken] = useState("");
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("imperiohq");

  // Form Zernio
  const [integrationMethod, setIntegrationMethod] = useState<"meta" | "zernio">("meta");
  const [zernioApiKey, setZernioApiKey] = useState("");
  const [zernioAccounts, setZernioAccounts] = useState<any[]>([]);
  const [selectedZernioAccountId, setSelectedZernioAccountId] = useState("");
  const [fetchingZernioAccounts, setFetchingZernioAccounts] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  // Form AI Config
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [instagramEnabled, setInstagramEnabled] = useState(false);
  const [instagramCommentsEnabled, setInstagramCommentsEnabled] = useState(false);
  const [instagramCommentsBehavior, setInstagramCommentsBehavior] = useState("reply_and_dm");
  const [instagramCommentsCustomDm, setInstagramCommentsCustomDm] = useState("");
  const [savingAi, setSavingAi] = useState(false);
  const [productFocus, setProductFocus] = useState("");

  async function load() {
    setLoading(true);
    const sb = supabase as any;
    const [accRes, credRes, configRes, projectRes] = await Promise.all([
      sb.from("imphq_ig_accounts").select("*").eq("project_id", projectId).maybeSingle(),
      sb.from("imphq_integration_credentials").select("credentials").eq("project_id", projectId).eq("provider", "instagram").maybeSingle(),
      sb.from("imphq_wa_ai_config").select("*").eq("project_id", projectId).is("provider_id", null).maybeSingle(),
      sb.from("imphq_projects").select("data").eq("id", projectId).maybeSingle(),
    ] as PromiseLike<any>[]);
    setAccount(accRes.data);
    const c = credRes.data?.credentials || {};
    if (c.app_id) setAppId(c.app_id);
    if (c.app_secret) setAppSecret(c.app_secret);
    if (c.webhook_verify_token) setVerifyToken(c.webhook_verify_token);

    if (c.auth_method === "zernio") {
      setIntegrationMethod("zernio");
      setZernioApiKey(c.zernio_api_key || "");
      setSelectedZernioAccountId(c.zernio_account_id || "");
    } else {
      setIntegrationMethod("meta");
    }

    if (configRes.data) {
      setAiConfig(configRes.data);
      setInstagramEnabled(configRes.data.instagram_enabled || false);
      setInstagramCommentsEnabled(configRes.data.instagram_comments_enabled || false);
      setInstagramCommentsBehavior(configRes.data.instagram_comments_behavior || "reply_and_dm");
      setInstagramCommentsCustomDm(configRes.data.instagram_comments_custom_dm || "");
    } else {
      setAiConfig(null);
      setInstagramEnabled(false);
      setInstagramCommentsEnabled(false);
      setInstagramCommentsBehavior("reply_and_dm");
      setInstagramCommentsCustomDm("");
    }

    if (projectRes.data) {
      const d = typeof projectRes.data.data === "string" ? JSON.parse(projectRes.data.data) : (projectRes.data.data || {});
      setProductFocus(d.produtos?.[0]?.oferta || d.briefing?.oferta || "");
    }
    
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

  async function saveAiConfig() {
    setSavingAi(true);
    try {
      const sb = supabase as any;
      const payload = {
        instagram_enabled: instagramEnabled,
        instagram_comments_enabled: instagramCommentsEnabled,
        instagram_comments_behavior: instagramCommentsBehavior,
        instagram_comments_custom_dm: instagramCommentsCustomDm || null,
        updated_at: new Date().toISOString()
      };
      
      let error;
      if (aiConfig?.id) {
        const res = await sb.from("imphq_wa_ai_config").update(payload).eq("id", aiConfig.id);
        error = res.error;
      } else {
        const res = await sb.from("imphq_wa_ai_config").insert({
          ...payload,
          project_id: projectId,
          enabled: false,
          personality: "assistente",
          tone: "profissional",
          max_tokens: 300,
          response_delay_seconds: 3,
        });
        error = res.error;
      }
      
      if (error) throw error;
      toast.success("Configurações de IA do Instagram salvas!");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar configurações de IA");
    } finally {
      setSavingAi(false);
    }
  }

  async function saveToken() {
    if (!accessToken.trim()) { toast.error("Cole o Access Token primeiro"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-api", {
        body: { action: "save_token", project_id: projectId, access_token: accessToken.trim(), app_id: appId.trim() || null, app_secret: appSecret.trim() || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Conectado: @${data.account.username}`);
      setAccessToken("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao conectar");
    } finally {
      setSaving(false);
    }
  }

  async function refreshToken() {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-api", {
        body: { action: "refresh_token", project_id: projectId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Token renovado por +60 dias");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function saveVerifyToken() {
    const sb = supabase as any;
    const { data: cur } = await sb
      .from("imphq_integration_credentials")
      .select("id, credentials")
      .eq("project_id", projectId)
      .eq("provider", "instagram")
      .maybeSingle();
    const credentials = { ...(cur?.credentials || {}), webhook_verify_token: verifyToken };
    if (cur) {
      await sb.from("imphq_integration_credentials").update({ credentials }).eq("id", cur.id);
    } else {
      await sb.from("imphq_integration_credentials").insert({ project_id: projectId, provider: "instagram", credentials });
    }
    toast.success("Verify token salvo");
  }

  async function fetchZernioAccountsList() {
    if (!zernioApiKey.trim()) {
      toast.error("Por favor, insira a Zernio API Key");
      return;
    }
    setFetchingZernioAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-api", {
        body: {
          action: "zernio_list_accounts",
          zernio_api_key: zernioApiKey.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const accounts = data.accounts || [];
      setZernioAccounts(accounts);
      if (accounts.length === 0) {
        toast.warning("Nenhuma conta do Instagram encontrada nesta chave do Zernio");
      } else {
        toast.success(`${accounts.length} conta(s) encontrada(s)`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao buscar contas no Zernio");
    } finally {
      setFetchingZernioAccounts(false);
    }
  }

  async function saveZernioToken() {
    if (!zernioApiKey.trim()) {
      toast.error("Por favor, insira a Zernio API Key");
      return;
    }
    if (!selectedZernioAccountId) {
      toast.error("Por favor, selecione uma conta do Instagram");
      return;
    }
    
    let selectedAcc = zernioAccounts.find(acc => (acc.id || acc._id) === selectedZernioAccountId);
    if (!selectedAcc && selectedZernioAccountId === account?.page_id) {
      selectedAcc = {
        _id: account.page_id,
        id: account.page_id,
        platformUserId: account.ig_user_id,
        username: account.username,
        name: account.display_name,
        avatarUrl: account.avatar_url,
      };
    }

    if (!selectedAcc) {
      toast.error("Conta selecionada inválida. Busque a lista de contas novamente.");
      return;
    }
    
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-api", {
        body: {
          action: "save_token",
          auth_method: "zernio",
          project_id: projectId,
          zernio_api_key: zernioApiKey.trim(),
          zernio_account_id: selectedAcc.id || selectedAcc._id,
          ig_user_id: selectedAcc.platformUserId,
          username: selectedAcc.username,
          display_name: selectedAcc.name || selectedAcc.username,
          avatar_url: selectedAcc.avatarUrl || null,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success(`Conectado via Zernio: @${data.account.username}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao conectar via Zernio");
    } finally {
      setSaving(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }

  const expiresAt = account?.expires_at ? new Date(account.expires_at) : null;
  const daysLeft = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 86400000) : null;
  const expiringSoon = daysLeft !== null && daysLeft < 10;

  return (
    <div className="space-y-6">
      {/* ─── STATUS DA CONTA ─── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-primary font-sans">
            <Instagram className="h-4 w-4" /> Conta Instagram
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
          ) : account ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                {account.avatar_url ? (
                  <img src={account.avatar_url} alt="" className="w-12 h-12 rounded-full border border-border" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center"><Instagram className="h-5 w-5" /></div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">@{account.username}</span>
                    {account.status === "active" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Ativa
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/15 text-red-300 border-red-500/30">
                        <XCircle className="h-3 w-3 mr-1" /> {account.status}
                      </Badge>
                    )}
                    {account.auth_method === "zernio" ? (
                      <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30">
                        Zernio API
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30">
                        Meta Direct
                      </Badge>
                    )}
                    {expiringSoon && account.auth_method !== "zernio" && (
                      <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                        Expira em {daysLeft}d
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{account.display_name} • IG ID: {account.ig_user_id}</p>
                </div>
              </div>
              {account.auth_method !== "zernio" && (
                <Button variant="outline" size="sm" onClick={refreshToken} disabled={refreshing}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                  Renovar token (+60d)
                </Button>
              )}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Nenhuma conta conectada ainda. Selecione um método abaixo e siga o guia.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ─── TABS DE SELEÇÃO DE MÉTODO ─── */}
      <Tabs value={integrationMethod} onValueChange={(val) => setIntegrationMethod(val as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="meta" className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-lg py-2.5 transition-all text-sm font-medium flex items-center justify-center gap-2">
            <Instagram className="h-4 w-4 text-pink-500" />
            Meta Direct (Oficial / n8n)
          </TabsTrigger>
          <TabsTrigger value="zernio" className="data-[state=active]:bg-background data-[state=active]:text-foreground rounded-lg py-2.5 transition-all text-sm font-medium flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 text-violet-500" />
            Zernio API (Sem App Review)
          </TabsTrigger>
        </TabsList>

        {/* ─── FLUXO META DIRECT ─── */}
        <TabsContent value="meta" className="mt-6 space-y-6">
          {/* GUIA PASSO A PASSO META */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📖 Guia — Conexão Direta (Meta API Oficial)</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible defaultValue="step1" className="w-full">
                <AccordionItem value="step1">
                  <AccordionTrigger className="text-sm">1. Pré-requisitos</AccordionTrigger>
                  <AccordionContent className="text-sm space-y-2 leading-7">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Conta <strong>Instagram Business</strong> (não pode ser perfil pessoal)</li>
                      <li>Página do Facebook vinculada a essa conta IG</li>
                      <li>Acesso de admin à página no Facebook Business Manager</li>
                    </ul>
                    <p className="text-xs text-muted-foreground">Se a sua conta IG ainda não é Business: <a href="https://help.instagram.com/502981923235522" target="_blank" rel="noopener" className="text-primary underline">Como converter</a></p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step2">
                  <AccordionTrigger className="text-sm">2. Criar/usar um App no Meta Developers</AccordionTrigger>
                  <AccordionContent className="text-sm space-y-2 leading-7">
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Acesse <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener" className="text-primary underline inline-flex items-center gap-1">developers.facebook.com/apps <ExternalLink className="h-3 w-3" /></a></li>
                      <li>Clique <strong>"Criar App"</strong> → tipo <strong>"Empresa"</strong></li>
                      <li>Nome do app: ex. "ImperioHQ — [Seu Projeto]"</li>
                      <li>No painel do app, em "Produtos", adicione <strong>"Instagram"</strong> e <strong>"Webhooks"</strong></li>
                      <li>Copie <strong>App ID</strong> e <strong>App Secret</strong> (em Configurações → Básicas)</li>
                    </ol>
                    <Alert className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">App ID e Secret são <strong>opcionais</strong>, mas necessários se você quiser <strong>renovar token automaticamente</strong> aqui na ImperioHQ.</AlertDescription>
                    </Alert>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step3">
                  <AccordionTrigger className="text-sm">3. Gerar Access Token (long-lived, 60 dias)</AccordionTrigger>
                  <AccordionContent className="text-sm space-y-2 leading-7">
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Abra <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener" className="text-primary underline inline-flex items-center gap-1">Graph API Explorer <ExternalLink className="h-3 w-3" /></a></li>
                      <li>Selecione o app criado</li>
                      <li>Clique em <strong>"Generate Access Token"</strong> e autorize com as permissões:
                        <div className="flex flex-wrap gap-1 mt-1">
                          {["instagram_basic","instagram_manage_messages","instagram_manage_comments","pages_show_list","pages_messaging","pages_read_engagement"].map(s => (
                            <code key={s} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded">{s}</code>
                          ))}
                        </div>
                      </li>
                      <li>Copie o token gerado (curto, 1-2h de validade)</li>
                      <li>Troque por <strong>long-lived</strong> (60 dias) em <a href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noopener" className="text-primary underline inline-flex items-center gap-1">Access Token Debugger <ExternalLink className="h-3 w-3" /></a> → botão "Extend Access Token"</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step4">
                  <AccordionTrigger className="text-sm">4. Colar credenciais aqui ↓</AccordionTrigger>
                  <AccordionContent className="text-sm leading-7">
                    <p>Use o formulário abaixo. A ImperioHQ vai descobrir automaticamente sua conta IG Business, salvar tudo seguro em <code>imphq_integration_credentials</code> e ativar o envio de DMs/comentários.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="step5">
                  <AccordionTrigger className="text-sm">5. Configurar Webhook (receber DMs e comentários)</AccordionTrigger>
                  <AccordionContent className="text-sm space-y-2 leading-7">
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>No app Meta → Produtos → <strong>Webhooks</strong> → escolha <strong>"Instagram"</strong></li>
                      <li>Cole esta URL de callback:
                        <div className="flex gap-2 mt-1">
                          <Input readOnly value={WEBHOOK_URL(projectId)} className="font-mono text-xs" />
                          <Button size="sm" variant="outline" onClick={() => copy(WEBHOOK_URL(projectId), "URL")}><Copy className="h-3.5 w-3.5" /></Button>
                        </div>
                      </li>
                      <li>Verify Token (cole no Meta o mesmo valor abaixo):
                        <div className="flex gap-2 mt-1">
                          <Input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} className="font-mono text-xs" />
                          <Button size="sm" variant="outline" onClick={() => copy(verifyToken, "Token")}><Copy className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" onClick={saveVerifyToken}>Salvar</Button>
                        </div>
                      </li>
                      <li>Subscribe nos campos: <code>messages</code>, <code>messaging_postbacks</code>, <code>comments</code>, <code>mentions</code></li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* FORMULÁRIO DE CREDENCIAIS META */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔑 Credenciais Meta</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowSecrets(!showSecrets)}>
                {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Access Token (long-lived) *</Label>
                <Input
                  type={showSecrets ? "text" : "password"}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAxxxxxxxxxxxx..."
                  className="font-mono text-xs mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Não armazenamos o valor exibido — apenas o que você colar será salvo.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">App ID (opcional, p/ refresh)</Label>
                  <Input
                    type={showSecrets ? "text" : "password"}
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="1234567890"
                    className="font-mono text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">App Secret (opcional, p/ refresh)</Label>
                  <Input
                    type={showSecrets ? "text" : "password"}
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="abc123..."
                    className="font-mono text-xs mt-1"
                  />
                </div>
              </div>
              <Button onClick={saveToken} disabled={saving || !accessToken.trim()} className="w-full">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {account && account.auth_method !== "zernio" ? "Atualizar conexão Meta" : "Conectar Instagram (Meta)"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── FLUXO ZERNIO API ─── */}
        <TabsContent value="zernio" className="mt-6 space-y-6">
          {/* GUIA PASSO A PASSO ZERNIO */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📖 Guia — Conexão Simplificada (Zernio API)</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible defaultValue="zstep1" className="w-full">
                <AccordionItem value="zstep1">
                  <AccordionTrigger className="text-sm">1. Criar conta no Zernio</AccordionTrigger>
                  <AccordionContent className="text-sm space-y-2 leading-7">
                    <p>
                      Acesse <a href="https://zernio.com" target="_blank" rel="noopener" className="text-primary underline inline-flex items-center gap-1">zernio.com <ExternalLink className="h-3 w-3" /></a> e crie uma conta gratuita.
                    </p>
                    <p>
                      No painel do Zernio, vá na seção <strong>Accounts</strong> e conecte sua conta do <strong>Instagram Business</strong>.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="zstep2">
                  <AccordionTrigger className="text-sm">2. Obter chave de API do Zernio</AccordionTrigger>
                  <AccordionContent className="text-sm space-y-2 leading-7">
                    <p>
                      Acesse a aba de desenvolvedores no painel do Zernio.
                    </p>
                    <p>
                      Copie a sua <strong>API Key</strong> (ela começa com <code>sk_</code>).
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="zstep3">
                  <AccordionTrigger className="text-sm">3. Configurar Webhook no Zernio</AccordionTrigger>
                  <AccordionContent className="text-sm space-y-2 leading-7">
                    <p>
                      No painel do Zernio, crie um novo webhook para receber mensagens em tempo real no ImperioX.
                    </p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>URL de Callback (cole a URL abaixo):
                        <div className="flex gap-2 mt-1">
                          <Input readOnly value={ZERNIO_WEBHOOK_URL(projectId)} className="font-mono text-xs" />
                          <Button size="sm" variant="outline" onClick={() => copy(ZERNIO_WEBHOOK_URL(projectId), "URL")}><Copy className="h-3.5 w-3.5" /></Button>
                        </div>
                      </li>
                      <li>Assinatura de Eventos: marque o evento <code>message.received</code></li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="zstep4">
                  <AccordionTrigger className="text-sm">4. Vincular conta abaixo ↓</AccordionTrigger>
                  <AccordionContent className="text-sm leading-7">
                    <p>Insira sua API Key abaixo, clique em "Buscar Contas", selecione sua conta correspondente e salve a conexão.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* FORMULÁRIO DE CREDENCIAIS ZERNIO */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔑 Credenciais Zernio</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowSecrets(!showSecrets)}>
                {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Zernio API Key *</Label>
                <Input
                  type={showSecrets ? "text" : "password"}
                  value={zernioApiKey}
                  onChange={(e) => setZernioApiKey(e.target.value)}
                  placeholder="sk_..."
                  className="font-mono text-xs mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Utilizada para gerenciar envios de mensagens.</p>
              </div>

              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={fetchZernioAccountsList} 
                  disabled={fetchingZernioAccounts || !zernioApiKey.trim()}
                  className="w-full md:w-auto text-xs"
                >
                  {fetchingZernioAccounts && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                  Buscar Contas no Zernio
                </Button>
              </div>

              {(zernioAccounts.length > 0 || (selectedZernioAccountId && zernioAccounts.length === 0)) && (
                <div className="space-y-2">
                  <Label className="text-xs">Selecione a Conta do Instagram *</Label>
                  <Select value={selectedZernioAccountId} onValueChange={setSelectedZernioAccountId}>
                    <SelectTrigger className="w-full font-mono text-xs">
                      <SelectValue placeholder="Selecione uma conta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {zernioAccounts.length === 0 && selectedZernioAccountId ? (
                        <SelectItem value={selectedZernioAccountId}>
                          {account?.username ? `@${account.username} (Salva)` : `Conta ID: ${selectedZernioAccountId}`}
                        </SelectItem>
                      ) : (
                        zernioAccounts.map((acc) => (
                          <SelectItem key={acc.id || acc._id} value={acc.id || acc._id}>
                            {acc.name || acc.username} (@{acc.username}) — ID: {acc.platformUserId}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button 
                onClick={saveZernioToken} 
                disabled={saving || !zernioApiKey.trim() || (!selectedZernioAccountId && zernioAccounts.length === 0)} 
                className="w-full"
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {account && account.auth_method === "zernio" ? "Atualizar conexão Zernio" : "Conectar via Zernio"}
              </Button>

              {account && account.auth_method === "zernio" && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={backfilling}
                  onClick={async () => {
                    setBackfilling(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("ig-zernio-backfill", {
                        body: { project_id: projectId, max_conversations: 50, max_messages: 30 },
                      });
                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);
                      toast.success(`Sincronizado: ${data.conversations_processed} conversas, ${data.messages_imported} mensagens`);
                    } catch (e: any) {
                      toast.error(e.message || "Falha ao sincronizar");
                    } finally {
                      setBackfilling(false);
                    }
                  }}
                >
                  {backfilling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sincronizar conversas do Zernio
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── CONFIGURAÇÃO DE IA DO INSTAGRAM ─── */}
      {account && (
        <Card className="bg-card border-border mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-primary font-sans">
              <Bot className="h-4 w-4 text-violet-500" /> Configuração de IA no Instagram
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4 p-4 bg-muted/20 border border-border/40 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">IA para Mensagens Diretas (DMs)</Label>
                <p className="text-xs text-muted-foreground">Responder automaticamente no Direct do Instagram usando a IA.</p>
              </div>
              <Switch checked={instagramEnabled} onCheckedChange={setInstagramEnabled} />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-muted/20 border border-border/40 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">IA para Comentários públicos</Label>
                <p className="text-xs text-muted-foreground">Responder comentários públicos nas publicações de forma inteligente.</p>
              </div>
              <Switch checked={instagramCommentsEnabled} onCheckedChange={setInstagramCommentsEnabled} />
            </div>

            {instagramCommentsEnabled && (
              <div className="space-y-4 pt-2 pl-4 border-l border-border/60">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Comportamento da IA para Comentários</Label>
                  <Select value={instagramCommentsBehavior} onValueChange={setInstagramCommentsBehavior}>
                    <SelectTrigger className="w-full md:max-w-md text-xs">
                      <SelectValue placeholder="Selecione o comportamento..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reply_and_dm">Responder comentário publicamente & Enviar Direct (DM)</SelectItem>
                      <SelectItem value="reply_only">Apenas responder comentário publicamente</SelectItem>
                      <SelectItem value="dm_only">Apenas enviar Direct (DM) privadamente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {instagramCommentsBehavior !== "reply_only" && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Mensagem de Direct (DM) enviada a partir de comentários</Label>
                    <Textarea
                      value={instagramCommentsCustomDm}
                      onChange={(e) => setInstagramCommentsCustomDm(e.target.value)}
                      placeholder={
                        productFocus
                          ? `Mensagem padrão da oferta será enviada:\n\n${productFocus}`
                          : "Olá! Vi que você comentou no nosso post. Como prometido, aqui estão as informações! Como posso te ajudar hoje?"
                      }
                      rows={4}
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Esta mensagem será enviada na DM do usuário quando ele interagir nos comentários. Deixe em branco para usar a oferta padrão do projeto.
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button onClick={saveAiConfig} disabled={savingAi} className="w-full">
              {savingAi && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Sparkles className="h-4 w-4 mr-2" /> Salvar Configurações de IA do Instagram
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
