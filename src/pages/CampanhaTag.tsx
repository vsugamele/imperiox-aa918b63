import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ChevronDown, ChevronRight, Download, MessageCircle, FileText, ShoppingBag, HelpCircle } from "lucide-react";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

type QA = { question: string; answer: string; created_at: string };

type Row = {
  lead_id: string;
  nome: string | null;
  phone: string | null;
  email: string | null;
  project_id: string | null;
  tagAddedAt: string | null;
  lastOptin: QA | null;
  optinCount: number;
  quizResponses: QA[];
  lastInbound: { content: string; created_at: string } | null;
  inboundCount: number;
  conversationStatus: string | null;
  assignedTo: string | null;
  vendas: Array<{ produto_nome: string | null; valor: number | null; data_venda: string | null }>;
};

// Detecta perguntas de opt-in básicas (nome, email, telefone, cpf)
const OPTIN_RX = /^(nome|name|full\s*name|e-?mail|email|telefone|whats?app|cel|celular|fone|phone|cpf|documento)\b/i;
const isOptin = (q: string) => !!q && OPTIN_RX.test(q.trim());

export default function CampanhaTag() {
  const { tag } = useParams<{ tag: string }>();
  const [params] = useSearchParams();
  const projectId = params.get("project") || "all";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "responded_wa" | "responded_form" | "responded_quiz" | "buyers">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    (async () => {
      if (!tag) return;
      setLoading(true);

      let tagQ = supabase
        .from("imphq_lead_tag_history")
        .select("lead_id, project_id, created_at")
        .eq("tag", tag)
        .eq("action", "added")
        .order("created_at", { ascending: false });
      if (projectId !== "all") tagQ = tagQ.eq("project_id", projectId);

      const { data: history } = await tagQ;

      const firstEntry = new Map<string, string>();
      (history || []).forEach((h: any) => {
        const prev = firstEntry.get(h.lead_id);
        if (!prev || new Date(h.created_at) < new Date(prev)) firstEntry.set(h.lead_id, h.created_at);
      });

      let leadsWithTagQ = supabase.from("imphq_leads").select("id, project_id, tags").contains("tags", [tag]);
      if (projectId !== "all") leadsWithTagQ = leadsWithTagQ.eq("project_id", projectId);
      const { data: leadsWithTag } = await leadsWithTagQ;
      (leadsWithTag || []).forEach((l: any) => {
        if (!firstEntry.has(l.id)) firstEntry.set(l.id, "");
      });

      const leadIds = Array.from(firstEntry.keys());
      if (leadIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const [{ data: leads }, { data: responses }, { data: convs }, { data: vendas }, projectRow] = await Promise.all([
        supabase.from("imphq_leads").select("id, nome, phone, email, project_id").in("id", leadIds) as PromiseLike<any>,
        supabase.from("imphq_lead_responses").select("lead_id, question, answer, created_at").in("lead_id", leadIds).order("created_at", { ascending: false }) as PromiseLike<any>,
        supabase.from("imphq_wa_conversations").select("id, lead_id, phone, status, assigned_to").in("lead_id", leadIds) as PromiseLike<any>,
        supabase.from("imphq_vendas").select("lead_id, produto_nome, valor, data_venda").in("lead_id", leadIds) as PromiseLike<any>,
        projectId !== "all" ? supabase.from("imphq_projects").select("name").eq("id", projectId).maybeSingle() as PromiseLike<any> : Promise.resolve({ data: null }),
      ]);

      if (projectRow?.data?.name) setProjectName(projectRow.data.name);

      const convIds = (convs || []).map((c: any) => c.id);
      const { data: messages } = convIds.length > 0
        ? await supabase.from("imphq_wa_messages").select("conversation_id, content, created_at, direction").in("conversation_id", convIds).eq("direction", "inbound").order("created_at", { ascending: false })
        : { data: [] as any };

      const leadIdx = new Map((leads || []).map((l: any) => [l.id, l]));
      const respByLead = new Map<string, any[]>();
      (responses || []).forEach((r: any) => {
        const arr = respByLead.get(r.lead_id) || [];
        arr.push(r);
        respByLead.set(r.lead_id, arr);
      });
      const convByLead = new Map<string, any>();
      (convs || []).forEach((c: any) => { if (!convByLead.has(c.lead_id)) convByLead.set(c.lead_id, c); });
      const msgsByConv = new Map<string, any[]>();
      (messages || []).forEach((m: any) => {
        const arr = msgsByConv.get(m.conversation_id) || [];
        arr.push(m);
        msgsByConv.set(m.conversation_id, arr);
      });
      const vendasByLead = new Map<string, any[]>();
      (vendas || []).forEach((v: any) => {
        const arr = vendasByLead.get(v.lead_id) || [];
        arr.push(v);
        vendasByLead.set(v.lead_id, arr);
      });

      const out: Row[] = leadIds.map((lid) => {
        const l: any = leadIdx.get(lid) || { id: lid, nome: null, phone: null, email: null };
        const resp = respByLead.get(lid) || [];
        const optin = resp.filter((r: any) => isOptin(r.question));
        const quiz = resp.filter((r: any) => !isOptin(r.question));
        const conv = convByLead.get(lid);
        const inbound = conv ? (msgsByConv.get(conv.id) || []) : [];
        return {
          lead_id: lid,
          nome: l.nome,
          phone: l.phone,
          email: l.email,
          project_id: l.project_id,
          tagAddedAt: firstEntry.get(lid) || null,
          lastOptin: optin[0] ? { question: optin[0].question, answer: optin[0].answer, created_at: optin[0].created_at } : null,
          optinCount: optin.length,
          quizResponses: quiz.map((q: any) => ({ question: q.question, answer: q.answer, created_at: q.created_at })),
          lastInbound: inbound[0] ? { content: inbound[0].content, created_at: inbound[0].created_at } : null,
          inboundCount: inbound.length,
          conversationStatus: conv?.status || null,
          assignedTo: conv?.assigned_to || null,
          vendas: vendasByLead.get(lid) || [],
        };
      });

      out.sort((a, b) => (b.tagAddedAt || "").localeCompare(a.tagAddedAt || ""));
      setRows(out);
      setLoading(false);
    })();
  }, [tag, projectId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "responded_wa" && r.inboundCount === 0) return false;
      if (filter === "responded_form" && r.optinCount === 0) return false;
      if (filter === "responded_quiz" && r.quizResponses.length === 0) return false;
      if (filter === "buyers" && r.vendas.length === 0) return false;
      if (search) {
        const q = search.toLowerCase();
        return (r.nome || "").toLowerCase().includes(q) || (r.phone || "").includes(q) || (r.email || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, filter, search]);

  const kpis = useMemo(() => ({
    total: rows.length,
    preencheuForm: rows.filter((r) => r.optinCount > 0).length,
    respondeuQuiz: rows.filter((r) => r.quizResponses.length > 0).length,
    respondeuWa: rows.filter((r) => r.inboundCount > 0).length,
    compradores: rows.filter((r) => r.vendas.length > 0).length,
  }), [rows]);

  // Agregado de respostas de pesquisa: pergunta -> resposta -> count
  const quizAggregate = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    rows.forEach((r) => {
      r.quizResponses.forEach((q) => {
        const qKey = q.question.trim();
        if (!map.has(qKey)) map.set(qKey, new Map());
        const answers = map.get(qKey)!;
        const aKey = (q.answer || "").trim() || "(vazio)";
        answers.set(aKey, (answers.get(aKey) || 0) + 1);
      });
    });
    return Array.from(map.entries()).map(([question, answers]) => ({
      question,
      total: Array.from(answers.values()).reduce((a, b) => a + b, 0),
      answers: Array.from(answers.entries()).sort((a, b) => b[1] - a[1]),
    })).sort((a, b) => b.total - a.total);
  }, [rows]);

  const [showAggregate, setShowAggregate] = useState(true);

  const exportCsv = () => {
    const header = ["Lead", "Telefone", "Email", "Entrou na tag", "Última resposta form", "Respostas pesquisa", "Última mensagem WA", "Status conversa", "Comprou", "Produtos"];
    const lines = filtered.map((r) => [
      r.nome || "",
      r.phone || "",
      r.email || "",
      r.tagAddedAt ? format(parseISO(r.tagAddedAt), "yyyy-MM-dd HH:mm") : "",
      r.lastOptin ? `${r.lastOptin.question}: ${r.lastOptin.answer}` : "",
      r.quizResponses.map((q) => `${q.question}: ${q.answer}`).join(" | "),
      r.lastInbound?.content || "",
      r.conversationStatus || "",
      r.vendas.length > 0 ? "sim" : "não",
      r.vendas.map((v) => v.produto_nome).filter(Boolean).join(" | "),
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campanha-${tag}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="font-cormorant text-3xl">
          Campanha: <span className="text-gold">{tag}</span>
        </h1>
        {projectName && <Badge variant="outline">{projectName}</Badge>}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total de leads</div><div className="text-2xl font-cormorant">{kpis.total}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Preencheu form</div><div className="text-2xl font-cormorant">{kpis.preencheuForm}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><HelpCircle className="h-3 w-3" />Respondeu pesquisa</div><div className="text-2xl font-cormorant text-gold">{kpis.respondeuQuiz}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Respondeu WhatsApp</div><div className="text-2xl font-cormorant">{kpis.respondeuWa}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Compradores</div><div className="text-2xl font-cormorant text-gold">{kpis.compradores}</div></Card>
      </div>

      {quizAggregate.length > 0 && (
        <Card className="p-4">
          <button className="flex items-center gap-2 text-sm font-medium w-full text-left" onClick={() => setShowAggregate((v) => !v)}>
            {showAggregate ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <HelpCircle className="h-4 w-4 text-gold" />
            Resultado da pesquisa ({quizAggregate.length} {quizAggregate.length === 1 ? "pergunta" : "perguntas"})
          </button>
          {showAggregate && (
            <div className="mt-4 space-y-4">
              {quizAggregate.map((q) => (
                <div key={q.question}>
                  <div className="text-xs text-muted-foreground mb-2">{q.question} <span className="text-foreground/60">· {q.total} respostas</span></div>
                  <div className="flex flex-wrap gap-2">
                    {q.answers.slice(0, 10).map(([answer, count]) => {
                      const pct = Math.round((count / q.total) * 100);
                      return (
                        <Badge key={answer} variant="outline" className="text-xs">
                          <span className="text-foreground">{answer}</span>
                          <span className="ml-2 text-gold">{count} · {pct}%</span>
                        </Badge>
                      );
                    })}
                    {q.answers.length > 10 && <span className="text-[10px] text-muted-foreground self-center">+{q.answers.length - 10} outras</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar nome, telefone ou email" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="responded_wa">Só quem respondeu no WA</SelectItem>
            <SelectItem value="responded_form">Só quem preencheu form</SelectItem>
            <SelectItem value="responded_quiz">Só quem respondeu pesquisa</SelectItem>
            <SelectItem value="buyers">Só compradores</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} de {rows.length}</div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-editorial text-muted-foreground">
              <tr>
                <th className="text-left p-3">Lead</th>
                <th className="text-left p-3">Entrou</th>
                <th className="text-left p-3"><FileText className="h-3 w-3 inline mr-1" />Form (opt-in)</th>
                <th className="text-left p-3"><HelpCircle className="h-3 w-3 inline mr-1" />Pesquisa / Quiz</th>
                <th className="text-left p-3"><MessageCircle className="h-3 w-3 inline mr-1" />Última msg WA</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3"><ShoppingBag className="h-3 w-3 inline mr-1" />Comprou</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum lead encontrado.</td></tr>}
              {filtered.map((r) => {
                const isExpanded = expanded.has(r.lead_id);
                const quizFirst = r.quizResponses[0];
                return (
                  <tr key={r.lead_id} className="border-t border-border/40 hover:bg-secondary/20 align-top">
                    <td className="p-3">
                      <Link to={`/leads/${r.lead_id}`} className="text-foreground hover:text-gold font-medium">{r.nome || "(sem nome)"}</Link>
                      <div className="text-xs text-muted-foreground">{r.phone || r.email || "—"}</div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {r.tagAddedAt ? formatDistanceToNow(parseISO(r.tagAddedAt), { addSuffix: true, locale: ptBR }) : "—"}
                    </td>
                    <td className="p-3 max-w-xs">
                      {r.lastOptin ? (
                        <div>
                          <div className="text-xs text-muted-foreground truncate">{r.lastOptin.question}</div>
                          <div className="text-foreground truncate">{r.lastOptin.answer}</div>
                          {r.optinCount > 1 && <div className="text-[10px] text-gold">+{r.optinCount - 1} campos</div>}
                        </div>
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="p-3 max-w-sm">
                      {quizFirst ? (
                        <div>
                          <div className="text-xs text-muted-foreground truncate">{quizFirst.question}</div>
                          <div className="text-foreground truncate font-medium">{quizFirst.answer}</div>
                          {r.quizResponses.length > 1 && (
                            <button onClick={() => toggleExpand(r.lead_id)} className="text-[10px] text-gold hover:underline mt-1 flex items-center gap-0.5">
                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              {isExpanded ? "recolher" : `+${r.quizResponses.length - 1} respostas`}
                            </button>
                          )}
                          {isExpanded && (
                            <div className="mt-2 space-y-2 border-l-2 border-gold/30 pl-2">
                              {r.quizResponses.slice(1).map((q, i) => (
                                <div key={i}>
                                  <div className="text-[10px] text-muted-foreground">{q.question}</div>
                                  <div className="text-xs text-foreground">{q.answer}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="p-3 max-w-xs">
                      {r.lastInbound ? (
                        <div>
                          <div className="text-foreground truncate">{r.lastInbound.content}</div>
                          <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(parseISO(r.lastInbound.created_at), { addSuffix: true, locale: ptBR })}{r.inboundCount > 1 ? ` · +${r.inboundCount - 1}` : ""}</div>
                        </div>
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="p-3 text-xs">
                      {r.conversationStatus ? <Badge variant="outline" className="text-xs">{r.conversationStatus}</Badge> : <span className="text-muted-foreground/50">—</span>}
                      {r.assignedTo && <div className="text-[10px] text-muted-foreground mt-1">{r.assignedTo}</div>}
                    </td>
                    <td className="p-3">
                      {r.vendas.length > 0 ? (
                        <Badge className="bg-gold/20 text-gold border-gold/30">
                          {r.vendas.map((v) => v.produto_nome).filter(Boolean).join(", ") || "sim"}
                        </Badge>
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
