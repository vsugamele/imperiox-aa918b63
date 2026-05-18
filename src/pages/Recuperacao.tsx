import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BucketCard } from "@/components/recuperacao/BucketCard";
import { RecoveryTable } from "@/components/recuperacao/RecoveryTable";
import { TemplateEditor } from "@/components/recuperacao/TemplateEditor";
import {
  buildRecoveryBuckets,
  DEFAULT_RECOVERY_TEMPLATES,
  formatCurrency,
  getAutomationBlueprint,
  getTemplateForBucket,
  interpolateRecoveryTemplate,
  mergeRecoveryTemplates,
  type RecoveryBucketId,
  type RecoveryItem,
  type RecoveryTemplateDraft,
} from "@/lib/recoveryBuckets";

export default function Recuperacao() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [storedTemplates, setStoredTemplates] = useState<any[]>([]);
  const [activeBucket, setActiveBucket] = useState<RecoveryBucketId>("pix_urgent");
  const [savingTemplateKey, setSavingTemplateKey] = useState<string | null>(null);
  const [templates, setTemplates] = useState<RecoveryTemplateDraft[]>([]);
  const [dispatchingBucket, setDispatchingBucket] = useState<RecoveryBucketId | null>(null);

  const selectedProject = searchParams.get("projeto") || "all";
  const selectedProjectName = useMemo(
    () => projects.find((project) => project.id === selectedProject)?.name,
    [projects, selectedProject],
  );

  const load = async () => {
    setLoading(true);
    const salesFrom = new Date(Date.now() - 45 * 86400000).toISOString();
    const logsFrom = new Date(Date.now() - 90 * 86400000).toISOString();

    let projectQuery = supabase.from("imphq_projects").select("id, name").order("name");
    let salesQuery = supabase
      .from("imphq_vendas")
      .select("id, project_id, lead_id, produto_nome, status, valor, created_at, data_venda, data")
      .gte("created_at", salesFrom);
    let leadsQuery = supabase
      .from("imphq_leads")
      .select("id, project_id, nome, email, phone, status, criado_em, updated_at, data")
      .limit(1000);
    let logsQuery = supabase.from("imphq_recovery_logs").select("*").gte("created_at", logsFrom);
    let templatesQuery = supabase.from("imphq_recovery_templates").select("*");

    if (selectedProject !== "all") {
      salesQuery = salesQuery.eq("project_id", selectedProject);
      leadsQuery = leadsQuery.eq("project_id", selectedProject);
      logsQuery = logsQuery.eq("project_id", selectedProject);
      templatesQuery = templatesQuery.eq("project_id", selectedProject);
    }

    const [projectsRes, salesRes, leadsRes, logsRes, templatesRes] = await Promise.all([
      projectQuery,
      salesQuery,
      leadsQuery,
      logsQuery,
      templatesQuery,
    ]);

    setProjects(projectsRes.data || []);
    setSales(salesRes.data || []);
    setLeads(leadsRes.data || []);
    setLogs(logsRes.data || []);
    setStoredTemplates(templatesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject || selectedProject === "all") {
      setTemplates([]);
      return;
    }
    setTemplates(mergeRecoveryTemplates(selectedProject, storedTemplates));
  }, [selectedProject, storedTemplates]);

  const buckets = useMemo(() => buildRecoveryBuckets({ vendas: sales, leads, logs }), [sales, leads, logs]);
  const activeItems = useMemo(() => buckets.find((bucket) => bucket.id === activeBucket)?.items || [], [buckets, activeBucket]);
  const currentRisk = useMemo(
    () => buckets.filter((bucket) => bucket.id !== "refunds").reduce((sum, bucket) => sum + bucket.totalValue, 0),
    [buckets],
  );
  const refundImpact = useMemo(() => buckets.find((bucket) => bucket.id === "refunds")?.totalValue || 0, [buckets]);

  const projectFilterOptions = useMemo(() => [{ id: "all", name: "Todos os projetos" }, ...projects], [projects]);

  const createLog = async (item: RecoveryItem, acao: string, status: string, canal?: string, observacao?: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("imphq_recovery_logs").insert({
      project_id: item.projectId,
      lead_id: item.leadId,
      venda_id: item.vendaId,
      bucket: item.bucket,
      acao,
      canal,
      status,
      valor: item.value || 0,
      observacao: observacao || null,
      created_by: auth.user?.id || null,
    } as any);

    if (error) throw error;
  };

  const getResolvedTemplate = (item: RecoveryItem, channel: "whatsapp" | "email") => {
    const projectScopedTemplates = item.projectId && selectedProject !== "all"
      ? templates
      : item.projectId
        ? mergeRecoveryTemplates(item.projectId, storedTemplates)
        : [];

    const fallback = DEFAULT_RECOVERY_TEMPLATES.find((template) => template.tipo === item.templateType && template.canal === channel);
    const template = getTemplateForBucket(projectScopedTemplates, item.projectId, item.bucket, channel);
    return {
      assunto: template?.assunto ?? fallback?.assunto ?? "",
      corpo: template?.corpo ?? fallback?.corpo ?? "",
    };
  };

  const handleWhatsApp = async (item: RecoveryItem) => {
    if (!item.phone) {
      toast.error("Este lead não tem telefone cadastrado.");
      return;
    }

    const template = getResolvedTemplate(item, "whatsapp");
    const message = interpolateRecoveryTemplate(template.corpo, item);
    await navigator.clipboard.writeText(message);
    await createLog(item, "template_whatsapp", "enviado", "whatsapp", "Mensagem copiada para envio manual");
    window.open(`https://wa.me/${item.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    toast.success("Mensagem pronta e copiada para o WhatsApp.");
    load();
  };

  const handleEmail = async (item: RecoveryItem) => {
    if (!item.email) {
      toast.error("Este lead não tem email cadastrado.");
      return;
    }

    const template = getResolvedTemplate(item, "email");
    const subject = interpolateRecoveryTemplate(template.assunto || "Recuperação de compra", item);
    const body = interpolateRecoveryTemplate(template.corpo, item);
    await navigator.clipboard.writeText(body);
    await createLog(item, "template_email", "enviado", "email", "Mensagem copiada para envio manual");
    window.open(`mailto:${item.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
    toast.success("Rascunho de email aberto e mensagem copiada.");
    load();
  };

  const handleMarkStatus = async (item: RecoveryItem, status: "recuperado" | "perdido") => {
    try {
      await createLog(item, status === "recuperado" ? "marcado_recuperado" : "marcado_perdido", status);
      toast.success(status === "recuperado" ? "Item marcado como recuperado." : "Item marcado como perdido.");
      load();
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar ação.");
    }
  };

  const handleSaveTemplate = async (template: RecoveryTemplateDraft) => {
    try {
      setSavingTemplateKey(template.key);
      const { data: auth } = await supabase.auth.getUser();
      const payload = {
        project_id: template.projectId,
        tipo: template.tipo,
        canal: template.canal,
        assunto: template.assunto || null,
        corpo: template.corpo,
        ativo: template.ativo,
        created_by: auth.user?.id || null,
      };

      const query = template.id
        ? supabase.from("imphq_recovery_templates").update(payload).eq("id", template.id)
        : supabase.from("imphq_recovery_templates").insert(payload as any);

      const { error } = await query;
      if (error) throw error;
      toast.success("Template salvo.");
      await load();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar template.");
    } finally {
      setSavingTemplateKey(null);
    }
  };

  const handleAutomateBucket = async (bucketId: RecoveryBucketId) => {
    if (selectedProject === "all") {
      toast.error("Selecione um projeto para criar a automação.");
      return;
    }

    const bucket = buckets.find((item) => item.id === bucketId);
    if (!bucket) return;

    const exampleItem = bucket.items[0] || {
      id: "preview",
      bucket: bucketId,
      templateType: bucket.templateType,
      projectId: selectedProject,
      leadId: null,
      vendaId: null,
      leadName: "{nome}",
      email: "",
      phone: "",
      product: "{produto}",
      value: 0,
      createdAt: new Date().toISOString(),
      ageLabel: "",
      lastContact: null,
      lastContactAt: null,
      paymentLink: "{link_pagamento}",
    } as RecoveryItem;

    const template = getResolvedTemplate(exampleItem, bucketId === "boleto_due" || bucketId === "refunds" ? "email" : "whatsapp");
    const { triggerTipo, acoes } = getAutomationBlueprint(bucketId, template.corpo);

    const { error } = await supabase.from("imphq_automacoes").insert({
      id: crypto.randomUUID(),
      nome: `Recuperação • ${bucket.shortTitle}`,
      trigger_tipo: triggerTipo,
      project_id: selectedProject,
      acoes: acoes as any,
      ativo: false,
      produto: null,
    } as any);

    if (error) {
      toast.error(error.message || "Erro ao criar automação.");
      return;
    }

    toast.success("Automação criada no OpenFlow em modo rascunho.");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <h1 className="font-display text-3xl font-semibold text-foreground">Retenção & Recuperação</h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Central para agir rápido sobre PIX em aberto, boletos, checkout abandonado e reembolsos.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selectedProject} onValueChange={(value) => setSearchParams(value === "all" ? {} : { projeto: value })}>
            <SelectTrigger className="w-full sm:w-[260px]">
              <SelectValue placeholder="Filtrar projeto" />
            </SelectTrigger>
            <SelectContent>
              {projectFilterOptions.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Em risco agora</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{formatCurrency(currentRisk)}</p>
            <p className="text-xs text-muted-foreground">PIX, boleto e carrinho sem conversão aprovada.</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Impacto de reembolso</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{formatCurrency(refundImpact)}</p>
            <p className="text-xs text-muted-foreground">Volume recente em reembolso ou chargeback.</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cobertura de templates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{templates.filter((template) => template.ativo).length || storedTemplates.length}</p>
            <p className="text-xs text-muted-foreground">Mensagens ativas para atuação manual ou automação.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5 md:grid-cols-2">
        {buckets.map((bucket) => (
          <BucketCard
            key={bucket.id}
            bucket={bucket}
            active={activeBucket === bucket.id}
            disabledAutomate={selectedProject === "all"}
            onSelect={() => setActiveBucket(bucket.id)}
            onAutomate={() => handleAutomateBucket(bucket.id)}
          />
        ))}
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">Fila de recuperação</CardTitle>
              <p className="text-sm text-muted-foreground">Ações rápidas com template pronto e histórico por bucket.</p>
            </div>
            <Tabs value={activeBucket} onValueChange={(value) => setActiveBucket(value as RecoveryBucketId)}>
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
                {buckets.map((bucket) => (
                  <TabsTrigger key={bucket.id} value={bucket.id} className="text-[11px]">
                    {bucket.shortTitle}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando oportunidades de recuperação...</div>
          ) : (
            <RecoveryTable
              items={activeItems}
              onSendWhatsApp={handleWhatsApp}
              onSendEmail={handleEmail}
              onMarkRecovered={(item) => handleMarkStatus(item, "recuperado")}
              onMarkLost={(item) => handleMarkStatus(item, "perdido")}
            />
          )}
        </CardContent>
      </Card>

      <TemplateEditor
        projectName={selectedProjectName}
        templates={templates}
        savingKey={savingTemplateKey}
        onChange={(template, patch) => {
          setTemplates((current) => current.map((item) => (item.key === template.key ? { ...item, ...patch } : item)));
        }}
        onSave={handleSaveTemplate}
      />
    </div>
  );
}
