import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Instagram, CheckCircle2, XCircle, ExternalLink, Copy, RefreshCw,
  Eye, EyeOff, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_URL = (projectId: string) =>
  `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/instagram-webhook?project=${projectId}`;

interface Props { projectId: string }

export function ProjetoInstagram({ projectId }: Props) {
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  // Form
  const [accessToken, setAccessToken] = useState("");
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("imperiohq");

  async function load() {
    setLoading(true);
    const sb = supabase as any;
    const [accRes, credRes] = await Promise.all([
      sb.from("imphq_ig_accounts").select("*").eq("project_id", projectId).maybeSingle(),
      sb.from("imphq_integration_credentials").select("credentials").eq("project_id", projectId).eq("provider", "instagram").maybeSingle(),
    ] as PromiseLike<any>[]);
    setAccount(accRes.data);
    const c = credRes.data?.credentials || {};
    if (c.app_id) setAppId(c.app_id);
    if (c.app_secret) setAppSecret(c.app_secret);
    if (c.webhook_verify_token) setVerifyToken(c.webhook_verify_token);
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

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
                  <div className="flex items-center gap-2">
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
                    {expiringSoon && (
                      <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                        Expira em {daysLeft}d
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{account.display_name} • IG ID: {account.ig_user_id}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={refreshToken} disabled={refreshing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                Renovar token (+60d)
              </Button>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Nenhuma conta conectada ainda. Siga o guia abaixo.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ─── GUIA PASSO A PASSO ─── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📖 Guia — Como conectar (10 min)</CardTitle>
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

      {/* ─── FORMULÁRIO DE CREDENCIAIS ─── */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔑 Credenciais</CardTitle>
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
            {account ? "Atualizar conexão" : "Conectar Instagram"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
