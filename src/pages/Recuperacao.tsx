import { record, toJson } from "@/lib/funis-data";
import type { Tables } from "@/integrations/supabase/types";
import { errorMessage } from "@/lib/error-message";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, Clock, RotateCcw, ShieldAlert, Zap } from "lucide-react";
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
  getTouchCadenceMessage,
  interpolateRecoveryTemplate,
  mergeRecoveryTemplates,
  type RecoveryBucketId,
  type RecoveryItem,
  type RecoveryTemplateDraft,
} from "@/lib/recoveryBuckets";

export default function Recuperacao() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Pick<Tables<"imphq_projects">,"id"|"name">[]>([]);
  const [sales, setSales] = useState<Pick<Tables<"imphq_vendas">,"id"|"project_id"|"lead_id"|"produto_nome"|"status"|"valor"|"created_at"|"data_venda"|"data">[]>([]);
  const [leads, setLeads] = useState<Pick<Tables<"imphq_leads">,"id"|"project_id"|"nome"|"email"|"phone"|"status"|"criado_em"|"updated_at"|"data">[]>([]);
  const [logs, setLogs] = useState<Tables<"imphq_recovery_logs">[]>([]);
  const [storedTemplates, setStoredTemplates] = useState<Tables<"imphq_recovery_templates">[]>([]);
  const [activeBucket, setActiveBucket] = useState<RecoveryBucketId>("pix_urgent");
  const [savingTemplateKey, setSavingTemplateKey] = useState<string | null>(null);
  const [templates, setTemplates] = useState<RecoveryTemplateDraft[]>([]);
  const [dispatchingBucket, setDispatchingBucket] = useState<RecoveryBucketId | null>(null);
  const [dispatchingItemId, setDispatchingItemId] = useState<string | null>(null);

  const selectedProject = searchParams.get("projeto") || "all";
  const selectedProjectName = useMemo(
    () => projects.find((project) => project.id === selectedProject)?.name,
    [projects, selectedProject],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const salesFrom = new Date(Date.now() - 45 * 86400000).toISOString();
    const logsFrom = new Date(Date.now() - 90 * 86400000).toISOString();

    const projectQuery = supabase.from("imphq_projects").select("id, name").order("name");
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
  }, [selectedProject]);

  useEffect(() => {
    load();
  }, [load]);

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
    });

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
    const cadenceCorpo = getTouchCadenceMessage(item, template.corpo);
    const message = interpolateRecoveryTemplate(cadenceCorpo, item);
    await navigator.clipboard.writeText(message);
    await createLog(item, "template_whatsapp", "enviado", "whatsapp", `Mensagem copiada para envio manual (${item.touchLabel || "Toque"})`);
    window.open(`https://wa.me/${item.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    toast.success("Mensagem pronta e copiada para o WhatsApp.");
    load();
  };

  const handleDirectWhatsApp = async (item: RecoveryItem) => {
    if (!item.phone) {
      toast.error("Este lead não possui telefone cadastrado.");
      return;
    }
    const targetProjectId = item.projectId || (selectedProject !== "all" ? selectedProject : null);
    if (!targetProjectId) {
      toast.error("Selecione um projeto para enviar via WhatsApp do projeto.");
      return;
    }
    try {
      setDispatchingItemId(item.id);
      const template = getResolvedTemplate(item, "whatsapp");
      const cadenceCorpo = getTouchCadenceMessage(item, template.corpo);
      const message = interpolateRecoveryTemplate(cadenceCorpo, item);

      const payload = {
        project_id: targetProjectId,
        bucket: item.bucket,
        max: 1,
        items: [
          {
            id: item.id,
            leadId: item.leadId,
            vendaId: item.vendaId,
            leadName: item.leadName,
            email: item.email,
            phone: item.phone,
            product: item.product,
            value: item.value,
            projectId: targetProjectId,
            pixCode: item.pixCode || null,
            paymentLink: item.paymentLink || null,
            touchLevel: item.touchLevel || 1,
            customMessage: message,
          },
        ],
      };

      const { data, error } = await supabase.functions.invoke("recovery-bucket-dispatch", { body: payload });
      if (error) throw error;
      const resp = record(data);
      const errMsg = typeof resp.error === "string" ? String(resp.error) : undefined;
      if (errMsg?.toLowerCase().includes("provider")) {
        toast.error("Nenhum WhatsApp ativo no projeto.", {
          action: { label: "Configurar", onClick: () => window.location.assign("/whatsapp") },
        });
        return;
      }
      const sent = Number(resp.sent) || 0;
      const details = Array.isArray(resp.details) ? (resp.details as Array<{ ok: boolean; error?: string }>) : [];
      if (sent > 0) {
        toast.success(`Mensagem enviada com sucesso no WhatsApp para ${item.leadName}!`);
      } else if (details[0]?.error === "already_purchased") {
        toast.info("Bloqueado pela Trava Anti-Duplicação: este cliente já comprou.");
      } else if (details[0]?.error === "already_sent_24h") {
        toast.info("Este lead já recebeu mensagem de recuperação nas últimas 24h.");
      } else {
        toast.error(`Falha no envio: ${details[0]?.error || "erro desconhecido"}`);
      }
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err) || "Erro ao disparar mensagem no WhatsApp.");
    } finally {
      setDispatchingItemId(null);
    }
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
    } catch (error: unknown) {
      toast.error(errorMessage(error) || "Erro ao registrar ação.");
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
        : supabase.from("imphq_recovery_templates").insert(payload);

      const { error } = await query;
      if (error) throw error;
      toast.success("Template salvo.");
      await load();
    } catch (error: unknown) {
      toast.error(errorMessage(error) || "Erro ao salvar template.");
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
      acoes: toJson(acoes),
      ativo: false,
      produto: null,
    });

    if (error) {
      toast.error(errorMessage(error) || "Erro ao criar automação.");
      return;
    }

    toast.success("Automação criada no OpenFlow em modo rascunho.");
  };

  const handleDispatchBucket = async (bucketId: RecoveryBucketId) => {
    if (selectedProject === "all") {
      toast.error("Selecione um projeto para disparar.");
      return;
    }
    const bucket = buckets.find((b) => b.id === bucketId);
    if (!bucket || bucket.items.length === 0) {
      toast.error("Nenhum item neste bucket.");
      return;
    }
    try {
      setDispatchingBucket(bucketId);
      const payload = {
        project_id: selectedProject,
        bucket: bucketId,
        max: 25,
        items: bucket.items.slice(0, 25).map((it) => {
          const template = getResolvedTemplate(it, "whatsapp");
          const cadenceCorpo = getTouchCadenceMessage(it, template.corpo);
          const message = interpolateRecoveryTemplate(cadenceCorpo, it);
          return {
            id: it.id,
            leadId: it.leadId,
            vendaId: it.vendaId,
            leadName: it.leadName,
            email: it.email,
            phone: it.phone,
            product: it.product,
            value: it.value,
            projectId: it.projectId || selectedProject,
            pixCode: it.pixCode || null,
            paymentLink: it.paymentLink || null,
            touchLevel: it.touchLevel || 1,
            customMessage: message,
          };
        }),
      };
      const { data, error } = await supabase.functions.invoke("recovery-bucket-dispatch", { body: payload });
      if (error) throw error;
      const errMsg = typeof record(data).error === "string" ? String(record(data).error) : undefined;
      if (errMsg?.toLowerCase().includes("provider")) {
        toast.error("Nenhum WhatsApp ativo neste projeto.", {
          action: { label: "Configurar", onClick: () => window.location.assign("/whatsapp") },
        });
        return;
      }
      const sent = record(data).sent ?? 0;
      const skipped = record(data).skipped ?? 0;
      toast.success(`Disparo: ${sent} enviadas, ${skipped} ignoradas pela trava.`, {
        action: { label: "Ver logs", onClick: () => window.location.assign("/imperius") },
      });
      load();
    } catch (err: unknown) {
      toast.error(errorMessage(err) || "Erro ao disparar bucket.");
    } finally {
      setDispatchingBucket(null);
    }
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

      {/* Banner Operacional: Régua de 3 Toques & Trava Anti-Duplicação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-foreground">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400">
            <Check className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-emerald-400">Trava Anti-Duplicação Estrita</p>
            <p className="text-muted-foreground text-[11px]">Leads com compra aprovada em qualquer canal saem do radar imediatamente.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3.5 text-xs text-foreground">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-500/20 text-sky-400">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-sky-400">Régua de 3 Toques Ativa</p>
            <p className="text-muted-foreground text-[11px]">Toque 1 (15m: Pix Copia e Cola) ➔ Toque 2 (2h: Reserva) ➔ Toque 3 (Urgência final).</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-foreground">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-amber-400">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-amber-400">Disparo 1-Clique no WhatsApp</p>
            <p className="text-muted-foreground text-[11px]">Envio instantâneo pelo WhatsApp ativo com código Pix Copia e Cola e link.</p>
          </div>
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
            onDispatch={() => handleDispatchBucket(bucket.id)}
            dispatching={dispatchingBucket === bucket.id}
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
              onDirectWhatsApp={handleDirectWhatsApp}
              onSendWhatsApp={handleWhatsApp}
              onSendEmail={handleEmail}
              onMarkRecovered={(item) => handleMarkStatus(item, "recuperado")}
              onMarkLost={(item) => handleMarkStatus(item, "perdido")}
              dispatchingId={dispatchingItemId}
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
