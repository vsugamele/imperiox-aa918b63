import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  MessageCircle,
  RefreshCw,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolveJPCourse, buildJPSupportMessage, JP_MEMBER_BASE_URL } from "@/lib/jpCourseMap";

interface LeadVenda {
  id: string;
  produto_nome?: string | null;
  valor?: number | null;
  status?: string | null;
}

interface LeadData {
  id: string;
  nome?: string | null;
  email?: string | null;
  phone?: string | null;
  project_id?: string | null;
  tags?: string[] | null;
  _vendas?: LeadVenda[];
  data?: unknown;
}

interface Props {
  lead: LeadData;
  projectName?: string | null;
  compact?: boolean;
}

export function LeadAccessDiagnosticCard({ lead, projectName, compact = false }: Props) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedMagic, setCopiedMagic] = useState(false);
  const [isGeneratingMagic, setIsGeneratingMagic] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [serverCheck, setServerCheck] = useState<{
    checked: boolean;
    hasAccess: boolean;
    email?: string;
  } | null>(null);

  // 1. Detecta o produto vendido para este lead
  const detectedProduct = React.useMemo(() => {
    // Das vendas confirmadas/pendentes
    if (lead._vendas && lead._vendas.length > 0) {
      const v = lead._vendas.find((v) => v.produto_nome && v.produto_nome.trim().length > 0);
      if (v?.produto_nome) return v.produto_nome;
    }
    // Das tags
    if (Array.isArray(lead.tags)) {
      const t = lead.tags.find((tag) => tag.toLowerCase().includes("corte") || tag.toLowerCase().includes("jp"));
      if (t) return t.replace(/^produto:|^prod:/i, "").trim();
    }
    return projectName || "Código dos Cortes Perfeitos";
  }, [lead, projectName]);

  const course = React.useMemo(() => {
    return resolveJPCourse(detectedProduct);
  }, [detectedProduct]);

  // Se o lead não é de JP Freitas nem comprou produtos JP, oculta o card
  const isJP = React.useMemo(() => {
    const isProj =
      lead.project_id === "jp_freitas" ||
      (projectName || "").toLowerCase().includes("jp freitas") ||
      (projectName || "").toLowerCase().includes("corte");
    const isProd =
      detectedProduct.toLowerCase().includes("corte") ||
      detectedProduct.toLowerCase().includes("finaliza") ||
      detectedProduct.toLowerCase().includes("tratamento") ||
      detectedProduct.toLowerCase().includes("jp");
    return isProj || isProd;
  }, [lead.project_id, projectName, detectedProduct]);

  if (!isJP) return null;

  const directUrl = course.directUrl;
  const activeLink = magicLink || directUrl;

  const handleCopyDirectLink = async () => {
    try {
      await navigator.clipboard.writeText(directUrl);
      setCopiedLink(true);
      toast.success("Link direto do curso copiado!");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleCopySupportMessage = async () => {
    try {
      const msg = buildJPSupportMessage({
        leadName: lead.nome,
        courseTitle: course.shortName,
        directUrl: activeLink,
        isMagicLink: !!magicLink,
      });
      await navigator.clipboard.writeText(msg);
      setCopiedMsg(true);
      toast.success("Mensagem cordial de suporte copiada!");
      setTimeout(() => setCopiedMsg(false), 2500);
    } catch {
      toast.error("Erro ao copiar mensagem.");
    }
  };

  const handleOpenWhatsApp = () => {
    const cleanPhone = (lead.phone || "").replace(/\D/g, "");
    if (!cleanPhone) {
      toast.error("Lead sem telefone cadastrado.");
      return;
    }
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const msg = buildJPSupportMessage({
      leadName: lead.nome,
      courseTitle: course.shortName,
      directUrl: activeLink,
      isMagicLink: !!magicLink,
    });
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleGenerateMagicLink = async () => {
    const email = lead.email?.trim().toLowerCase();
    if (!email) {
      toast.error("Lead não possui e-mail cadastrado. Solicite o e-mail usado na compra.");
      return;
    }

    setIsGeneratingMagic(true);
    try {
      const { data, error } = await supabase.functions.invoke("jp-access-manager", {
        body: {
          action: "issue_magic_link",
          email,
          program_id: course.programId,
          redirect_path: course.directPath,
        },
      });

      if (error || !data?.ok) {
        throw new Error(data?.error || error?.message || "Falha ao emitir token de acesso");
      }

      setMagicLink(data.magic_link);
      toast.success("✨ Magic Link sem senha gerado com sucesso! Redireciona direto ao curso.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setIsGeneratingMagic(false);
    }
  };

  const handleDiagnoseServer = async () => {
    setIsDiagnosing(true);
    try {
      const { data, error } = await supabase.functions.invoke("jp-access-manager", {
        body: {
          action: "diagnose",
          email: lead.email,
          phone: lead.phone,
          lead_id: lead.id,
        },
      });

      if (error || !data?.ok) {
        throw new Error(data?.error || error?.message || "Erro ao consultar área de membros");
      }

      setServerCheck({
        checked: true,
        hasAccess: data.hasAccess,
        email: data.email,
      });

      if (data.hasAccess) {
        toast.success("✅ Acesso verificado: aluno possui direito ativo na plataforma!");
      } else {
        toast.warning("⚠️ Aluno não possui direito ativo ou compra confirmada para este e-mail.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setIsDiagnosing(false);
    }
  };

  if (compact) {
    return (
      <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-amber-400" />
            <span className="text-[11px] font-bold text-foreground truncate">{course.shortName}</span>
          </div>
          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            Acesso Direto
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-1.5 gap-1 border-slate-700 bg-slate-800/80 hover:bg-slate-700"
            onClick={handleCopyDirectLink}
          >
            {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            Link Curso
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-1.5 gap-1 border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            onClick={handleGenerateMagicLink}
            disabled={isGeneratingMagic}
          >
            <KeyRound className="h-3 w-3" />
            {isGeneratingMagic ? "Gerando..." : "Magic Link"}
          </Button>
        </div>

        {magicLink && (
          <div className="p-1.5 bg-slate-950/80 rounded border border-amber-500/40 text-[9px] font-mono text-amber-200 flex items-center justify-between gap-1">
            <span className="truncate">{magicLink}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(magicLink);
                toast.success("Magic Link copiado!");
              }}
              className="text-amber-400 hover:text-amber-300"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/90 to-slate-950 p-4 shadow-xl space-y-4">
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header com Diagnóstico em Tempo Real */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 text-[10px] gap-1 shadow-sm">
              <Sparkles className="h-3 w-3" /> Diagnóstico IA & Acesso Membros
            </Badge>

            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-mono text-[10px] flex items-center gap-1"
            >
              <ShieldCheck className="h-3 w-3" />
              {serverCheck?.hasAccess ? "Acesso 100% Confirmado no Servidor" : "Cliente com Produto Ativo"}
            </Badge>

            {lead.email && (
              <Badge variant="outline" className="border-slate-700 bg-slate-800 text-slate-300 text-[10px] font-mono">
                📧 {lead.email}
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 pt-0.5">
            <GraduationCap className="h-4 w-4 text-amber-400" />
            {course.title}
          </h4>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 shrink-0 self-start sm:self-auto gap-1.5"
          onClick={handleDiagnoseServer}
          disabled={isDiagnosing}
        >
          <RefreshCw className={`h-3 w-3 ${isDiagnosing ? "animate-spin" : ""}`} />
          {isDiagnosing ? "Verificando..." : "Auditar no Servidor JP"}
        </Button>
      </div>

      {/* Alerta Anti-Alucinação & Causa Raiz de 'Acesso Negado' */}
      <div className="p-3 rounded-lg border border-amber-500/25 bg-amber-950/20 text-xs text-amber-200/90 leading-relaxed flex items-start gap-2.5 shadow-inner">
        <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-300">
            Atenção ao Pós-Venda: Por que alunas relatam "Acesso Negado"?
          </p>
          <p className="text-[11px] text-slate-300">
            A aluna comprou um curso individual (ex: <strong>{course.shortName}</strong> por R$ 47). Ao fazer login na Home genérica (<code>/home</code>), o card principal em destaque é a <strong>Formação Completa JP Hair</strong> (R$ 797). Se ela clicar nesse banner, a plataforma exibe <em>"Você não possui acesso a este conteúdo"</em>.
          </p>
          <p className="text-[11px] text-emerald-300 font-medium">
            ✅ <strong>Solução Instantânea:</strong> Entregue o <strong>Link Direto</strong> do módulo dela ou gere o <strong>Magic Link com redirecionamento automático</strong> abaixo.
          </p>
        </div>
      </div>

      {/* Caixa do Link Direto e Ações Rápidas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <KeyRound className="h-3 w-3 text-amber-400" />
            Link Direto do Curso ({course.shortName}):
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Redirecionamento automático sem tela de erro</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-950 p-2 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 truncate select-all">
            {activeLink}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs gap-1.5 shrink-0"
            onClick={handleCopyDirectLink}
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedLink ? "Copiado!" : "Copiar Link"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs gap-1.5 shrink-0"
            asChild
          >
            <a href={activeLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> Abrir
            </a>
          </Button>
        </div>
      </div>

      {/* Seção Magic Link Sem Senha (Token Seguro) */}
      <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-amber-400" />
            Magic Link Sem Senha (Login Instantâneo)
          </p>
          <p className="text-[11px] text-slate-400">
            Gera um token com validade de 24h que faz login direto e redireciona direto para o curso da aluna.
          </p>
        </div>

        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold h-8 text-xs shrink-0 gap-1.5 shadow-sm"
          onClick={handleGenerateMagicLink}
          disabled={isGeneratingMagic || !lead.email}
          title={!lead.email ? "Cadastre o e-mail do lead para gerar" : "Gerar link temporário sem senha"}
        >
          <KeyRound className={`h-3.5 w-3.5 ${isGeneratingMagic ? "animate-spin" : ""}`} />
          {isGeneratingMagic ? "Emitindo Token..." : "Gerar Magic Link"}
        </Button>
      </div>

      {/* Ações de Comunicação WhatsApp */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-slate-700 bg-slate-800/90 text-slate-200 hover:bg-slate-700 gap-1.5"
            onClick={handleCopySupportMessage}
          >
            {copiedMsg ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedMsg ? "Mensagem Copiada!" : "Copiar Resposta WhatsApp"}
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5"
            onClick={handleOpenWhatsApp}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Enviar no WhatsApp do Lead
          </Button>
        </div>

        <span className="text-[10px] text-slate-400 italic">
          Mensagem cordialmente formatada com aviso anti-frustração embutido.
        </span>
      </div>
    </div>
  );
}
