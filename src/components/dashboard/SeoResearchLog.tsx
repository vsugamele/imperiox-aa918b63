import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseSeo, radarResearch, SEO_PREFIX, seoNoteId, type SeoResearch } from "@/lib/seo-research";
import { toast } from "sonner";

export function SeoResearchLog({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [pending, setPending] = useState<SeoResearch[]>([]);
  const [editing, setEditing] = useState<{ id: string; research: SeoResearch } | null>(null);
  const [busy, setBusy] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [collectedAt, setCollectedAt] = useState(new Date().toISOString().slice(0,10));
  const queryKey = ["seo-research", projectId];
  const notes = useQuery({ queryKey, queryFn: async () => {
    const { data, error } = await supabase.from("imphq_project_notes").select("id,content,created_at").eq("project_id", projectId).like("content", `${SEO_PREFIX}%`).order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return (data ?? []).flatMap(n => { const research = parseSeo(n.content); return research ? [{ id: n.id, research }] : []; });
  }});
  const importRows = async (rows: SeoResearch[]) => {
    if (!user) return;
    setBusy(true);
    try {
      const payload = await Promise.all(rows.map(async r => ({ id: await seoNoteId(projectId,r), project_id: projectId, author_id: user.id, author_name: "Pesquisa SEO", content: SEO_PREFIX + JSON.stringify(r), created_at: r.collectedAt })));
      // Existing PK is id. Ignore existing rows, preserving origin date, decisions and outcomes on re-import.
      const { error } = await supabase.from("imphq_project_notes").upsert(payload, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
      setPending([]); setKeyword("");
      await client.invalidateQueries({ queryKey });
      toast.success("Pesquisas salvas no projeto; duplicatas preservadas");
    } catch { toast.error("Não foi possível salvar a pesquisa SEO"); } finally { setBusy(false); }
  };
  const update = async () => {
    if (!editing || !user) return;
    setBusy(true);
    const { error } = await supabase.from("imphq_project_notes").update({ content: SEO_PREFIX + JSON.stringify(editing.research), updated_at: new Date().toISOString() }).eq("id", editing.id).eq("project_id", projectId);
    setBusy(false);
    if (error) { toast.error("Não foi possível salvar decisão e resultado"); return; }
    setEditing(null); client.invalidateQueries({ queryKey });
  };
  return <details className="border border-border rounded p-3 text-xs"><summary>Pesquisas e oportunidades SEO · projeto {projectId}</summary>
    <p className="my-2 text-muted-foreground">Arquivo do radar Healthy: origem e data preservadas. Score é heurístico, volume desconhecido. A associação ao projeto abaixo é explícita. Importar pesquisas não aprova nem publica artigos.</p>
    <label>Carregar relatório JSON do radar<input className="block my-2" type="file" accept="application/json,.json" disabled={busy} onChange={async e => {
      setPending([]);
      const file = e.target.files?.[0]; if (!file) return;
      try { if (file.size > 1024 * 1024) throw new Error(); setPending(radarResearch(JSON.parse(await file.text()))); } catch { toast.error("Arquivo do radar inválido"); }
      e.target.value = "";
    }} /></label>
    {pending.length > 0 && <div className="my-2"><p>{pending.length} oportunidades · {pending[0].collectedAt} · {pending[0].sourceUrl}</p><Button disabled={busy || !user} onClick={() => importRows(pending)}>Associar e importar no projeto {projectId}</Button></div>}
    <div className="grid gap-2 my-3 md:grid-cols-2">
      <Input aria-label="Keyword da pesquisa" placeholder="Keyword / pergunta pesquisada" value={keyword} onChange={e => setKeyword(e.target.value)} />
      <Input aria-label="Origem da pesquisa" placeholder="Origem (ex.: pesquisa manual)" value={source} onChange={e => setSource(e.target.value)} />
      <Input aria-label="URL da origem" placeholder="URL / referência da origem" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
      <Input aria-label="Data da pesquisa" type="date" value={collectedAt} onChange={e => setCollectedAt(e.target.value)} />
      <Button disabled={busy || !user || !keyword.trim() || !source.trim() || !sourceUrl.trim() || !collectedAt} onClick={() => importRows([{ keyword: keyword.trim(), source: source.trim(), sourceUrl: sourceUrl.trim(), collectedAt: `${collectedAt}T00:00:00.000Z`, score: null, volume: null, decision: "Aguardando decisão", result: "Sem resultado medido", raw: {} }])}>Salvar pesquisa no projeto</Button>
    </div>
    {notes.isError && <p role="alert">Fonte de pesquisas indisponível; não foi possível ler as notas.</p>}
    {notes.isLoading && <p>Carregando pesquisas…</p>}
    {notes.data?.length === 0 && <p>Sem pesquisas SEO registradas.</p>}
    {notes.data?.length === 500 && <p>Cobertura incompleta: mostrando as 500 pesquisas mais recentes.</p>}
    <div className="max-h-80 overflow-auto space-y-2">{notes.data?.map(n => <div key={n.id} className="border-t border-border pt-2">
      <strong>{n.research.keyword}</strong><p>{n.research.source} · {n.research.collectedAt} · score heurístico {n.research.score ?? "—"} · volume sem dado</p><p className="break-all">Origem: {n.research.sourceUrl}</p>
      <p>Decisão: {n.research.decision}</p><p>Resultado: {n.research.result}</p>
      <Button size="sm" variant="outline" disabled={busy || !user} onClick={() => setEditing({ id: n.id, research: { ...n.research } })}>Registrar decisão / resultado</Button>
    </div>)}</div>
    {editing && <div className="space-y-2 mt-3"><p>{editing.research.keyword}</p><Textarea aria-label="Decisão SEO" value={editing.research.decision} onChange={e => setEditing({ ...editing, research: { ...editing.research, decision: e.target.value } })} /><Textarea aria-label="Resultado SEO" value={editing.research.result} onChange={e => setEditing({ ...editing, research: { ...editing.research, result: e.target.value } })} /><Button disabled={busy} onClick={update}>Salvar decisão e resultado</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button></div>}
  </details>;
}
