import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Send, Eye, EyeOff, Mail, Settings, History, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_body: string;
}

interface EmailConfig {
  resend_api_key?: string;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  templates?: EmailTemplate[];
}

interface Props {
  projectId: string;
  project: any;
  onUpdateData: (data: any) => void;
}

export function ProjetoEmails({ projectId, project, onUpdateData }: Props) {
  // Fallback: ler config do Briefing (data.checklist.resend) se email_config não tiver
  const rawConfig: EmailConfig = project.data?.email_config || {};
  const briefingResend = project.data?.checklist?.resend || {};
  const config: EmailConfig = {
    resend_api_key: rawConfig.resend_api_key || briefingResend.resend_api_key || "",
    from_email: rawConfig.from_email || briefingResend.from_email || "",
    from_name: rawConfig.from_name || briefingResend.from_name || "",
    reply_to: rawConfig.reply_to || briefingResend.reply_to || "",
    templates: rawConfig.templates || [],
  };
  const templates = config.templates || [];

  const [emailHistory, setEmailHistory] = useState<any[]>([]);
  const [showResendKey, setShowResendKey] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", subject: "", html_body: "" });
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  const loadEmailHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data: events } = await supabase
        .from("imphq_events")
        .select("*")
        .eq("project_id", projectId)
        .eq("event_name", "email_sent")
        .order("created_at", { ascending: false })
        .limit(50);
      setEmailHistory(events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadEmailHistory();
  }, [loadEmailHistory]);

  const updateConfig = useCallback((partial: Partial<EmailConfig>) => {
    const newConfig = { ...config, ...partial };
    onUpdateData({ ...(project.data || {}), email_config: newConfig });
  }, [config, project.data, onUpdateData]);

  const saveTemplate = () => {
    if (!templateForm.name.trim() || !templateForm.subject.trim()) {
      toast.error("Nome e assunto são obrigatórios");
      return;
    }
    let newTemplates: EmailTemplate[];
    if (editingTemplate) {
      newTemplates = templates.map(t =>
        t.id === editingTemplate.id
          ? { ...t, name: templateForm.name, subject: templateForm.subject, html_body: templateForm.html_body }
          : t
      );
    } else {
      newTemplates = [...templates, {
        id: crypto.randomUUID(),
        name: templateForm.name,
        subject: templateForm.subject,
        html_body: templateForm.html_body,
      }];
    }
    updateConfig({ templates: newTemplates });
    setShowTemplateDialog(false);
    setEditingTemplate(null);
    setTemplateForm({ name: "", subject: "", html_body: "" });
    toast.success(editingTemplate ? "Template atualizado" : "Template criado");
  };

  const deleteTemplate = (id: string) => {
    updateConfig({ templates: templates.filter(t => t.id !== id) });
    toast.success("Template removido");
  };

  const openEditTemplate = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({ name: t.name, subject: t.subject, html_body: t.html_body });
    setShowTemplateDialog(true);
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: "", subject: "", html_body: "" });
    setShowTemplateDialog(true);
  };

  const sendTestEmail = async (template: EmailTemplate) => {
    if (!testEmail.trim()) { toast.error("Informe o email de teste"); return; }
    if (!config.resend_api_key) { toast.error("Configure a API Key do Resend primeiro"); return; }
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-project-email", {
        body: { project_id: projectId, template_id: template.id, to_email: testEmail },
      });
      if (error) throw error;
      toast.success("Email de teste enviado!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Erro desconhecido"));
    } finally {
      setSendingTest(false);
    }
  };

  const isConfigured = !!config.resend_api_key && !!config.from_email;

  return (
    <div className="space-y-6">
      {/* Config Card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
            <Settings className="h-4 w-4" /> Configuração Resend
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">Configure a API do Resend para enviar emails deste projeto</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">API Key Resend</Label>
            <Input
              type="password"
              value={config.resend_api_key || ""}
              onChange={e => updateConfig({ resend_api_key: e.target.value })}
              className="bg-secondary"
              placeholder="re_xxxxxxxx..."
            />
            <p className="text-[9px] text-muted-foreground mt-1">Encontre em resend.com/api-keys</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email Remetente (From)</Label>
            <Input
              value={config.from_email || ""}
              onChange={e => updateConfig({ from_email: e.target.value })}
              className="bg-secondary"
              placeholder="contato@seudominio.com"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Nome do Remetente</Label>
            <Input
              value={config.from_name || ""}
              onChange={e => updateConfig({ from_name: e.target.value })}
              className="bg-secondary"
              placeholder="JP Freitas"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Reply-To</Label>
            <Input
              value={config.reply_to || ""}
              onChange={e => updateConfig({ reply_to: e.target.value })}
              className="bg-secondary"
              placeholder="suporte@seudominio.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Status */}
      <div className="flex items-center gap-2">
        <Badge variant={isConfigured ? "default" : "outline"} className={isConfigured ? "bg-emerald-500/20 text-emerald-400" : ""}>
          {isConfigured ? "✓ Resend Configurado" : "○ Resend não configurado"}
        </Badge>
        <Badge variant="outline">{templates.length} template{templates.length !== 1 ? "s" : ""}</Badge>
      </div>

      {/* Templates */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
              <Mail className="h-4 w-4" /> Templates de Email
            </CardTitle>
            <Button size="sm" variant="outline" onClick={openNewTemplate} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Novo Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum template criado. Crie templates para enviar emails aos leads.
            </p>
          ) : (
            <div className="space-y-3">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">Assunto: {t.subject}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                      placeholder="email@teste.com"
                      className="bg-background h-7 text-xs w-40 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => sendTestEmail(t)}
                      disabled={sendingTest}
                      title="Enviar teste"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreviewTemplate(t)} title="Preview">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditTemplate(t)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTemplate(t.id)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Template</Label>
              <Input value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Boas-vindas" className="bg-secondary" />
            </div>
            <div>
              <Label>Assunto</Label>
              <Input value={templateForm.subject} onChange={e => setTemplateForm(f => ({ ...f, subject: e.target.value }))} placeholder="Ex: Bem-vindo ao curso!" className="bg-secondary" />
            </div>
            <div>
              <Label>Corpo HTML</Label>
              <Textarea
                value={templateForm.html_body}
                onChange={e => setTemplateForm(f => ({ ...f, html_body: e.target.value }))}
                placeholder="<h1>Olá {{nome}}</h1><p>Bem-vindo!</p>"
                className="bg-secondary min-h-[200px] font-mono text-xs"
              />
              <p className="text-[9px] text-muted-foreground mt-1">Use {"{{nome}}"}, {"{{email}}"} como variáveis</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancelar</Button>
            <Button onClick={saveTemplate}>{editingTemplate ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="border border-border rounded-lg p-4 bg-white text-black">
            <p className="text-xs text-gray-500 mb-2">Assunto: {previewTemplate?.subject}</p>
            <div dangerouslySetInnerHTML={{ __html: previewTemplate?.html_body || "<p>Sem conteúdo</p>" }} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Histórico de Envios */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de Envios
            </CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={loadEmailHistory} disabled={loadingHistory}>
              <RefreshCw className={`h-3 w-3 mr-1 ${loadingHistory ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {emailHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum email enviado ainda. Envie um email de teste para ver o histórico.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Destinatário</TableHead>
                  <TableHead className="text-xs">Template</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailHistory.map((ev: any) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs">{ev.data?.to_email || "—"}</TableCell>
                    <TableCell className="text-xs">{ev.data?.template_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={ev.data?.status === "sent" ? "default" : "destructive"} className={ev.data?.status === "sent" ? "bg-emerald-500/20 text-emerald-400 text-[10px]" : "text-[10px]"}>
                        {ev.data?.status === "sent" ? "Enviado" : "Erro"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ev.created_at ? format(new Date(ev.created_at), "dd/MM/yyyy HH:mm") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Card informativo sobre webhooks Resend */}
          <div className="mt-4 p-3 rounded-lg border border-border bg-secondary/30">
            <p className="text-xs font-medium mb-1">📊 Rastrear aberturas e cliques</p>
            <p className="text-[10px] text-muted-foreground mb-2">
              Para rastrear aberturas (open), cliques e bounces, configure um webhook no painel do Resend apontando para a API do Imperio.
            </p>
            <a
              href="https://resend.com/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Configurar Webhooks no Resend
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
