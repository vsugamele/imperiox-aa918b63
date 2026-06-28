import { useEffect, useMemo, useState } from "react";
import { Globe, Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SiteCard, type Site } from "@/components/sites/SiteCard";
import { AddSiteModal } from "@/components/sites/AddSiteModal";
import { AttachToProjectModal } from "@/components/sites/AttachToProjectModal";
import { UseAsBaseModal } from "@/components/sites/UseAsBaseModal";
import { CreateEcosystemModal } from "@/components/sites/CreateEcosystemModal";

const TIPOS = [
  { value: "lp", label: "Landing Page" },
  { value: "vsl", label: "VSL" },
  { value: "checkout", label: "Checkout" },
  { value: "obrigado", label: "Obrigado" },
  { value: "captura", label: "Captura" },
  { value: "outro", label: "Outro" },
];

export default function Sites() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<string>("__all__");
  const [status, setStatus] = useState<string>("ativo");
  const [addOpen, setAddOpen] = useState(false);
  const [attachSite, setAttachSite] = useState<Site | null>(null);
  const [baseSite, setBaseSite] = useState<Site | null>(null);
  const [ecoSite, setEcoSite] = useState<Site | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_sites")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setSites((data || []) as Site[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return sites.filter((s) => {
      if (tipo !== "__all__" && s.tipo !== tipo) return false;
      if (status !== "__all__" && s.status !== status) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (!s.titulo.toLowerCase().includes(needle) && !s.url.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [sites, q, tipo, status]);

  async function handleArchive(s: Site) {
    const next = s.status === "arquivado" ? "ativo" : "arquivado";
    const { error } = await supabase.from("imphq_sites").update({ status: next }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(next === "arquivado" ? "Arquivado" : "Reativado");
    load();
  }

  async function handleDelete(s: Site) {
    if (!confirm(`Excluir o site "${s.titulo}"?`)) return;
    const { error } = await supabase.from("imphq_sites").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Site excluído");
    load();
  }

  async function handleRescrape(s: Site) {
    toast.info("Atualizando…");
    const { data, error } = await supabase.functions.invoke("site-scrape", { body: { url: s.url } });
    if (error || !data?.success) return toast.error(error?.message || data?.error || "Falha");
    await supabase.from("imphq_sites").update({
      titulo: data.title || s.titulo,
      thumbnail_url: data.screenshot || s.thumbnail_url,
      branding_json: data.branding || s.branding_json,
      content_md: data.markdown || s.content_md,
      summary: data.summary || s.summary,
      last_scraped_at: new Date().toISOString(),
    }).eq("id", s.id);
    toast.success("Site atualizado");
    load();
  }

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Globe className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-serif">Sites</h1>
            <p className="text-sm text-muted-foreground">Catálogo de LPs, VSLs e checkouts dos seus projetos</p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar site
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título ou URL…" className="pl-8" />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="arquivado">Arquivados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border border-dashed rounded-lg">
          <Globe className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>Nenhum site ainda.</p>
          <Button variant="link" onClick={() => setAddOpen(true)}>Adicionar o primeiro</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <SiteCard
              key={s.id}
              site={s}
              onAttach={() => setAttachSite(s)}
              onUseAsBase={() => setBaseSite(s)}
              onArchive={() => handleArchive(s)}
              onDelete={() => handleDelete(s)}
              onRescrape={() => handleRescrape(s)}
            />
          ))}
        </div>
      )}

      <AddSiteModal open={addOpen} onOpenChange={setAddOpen} onCreated={load} />
      <AttachToProjectModal site={attachSite} onOpenChange={(o) => !o && setAttachSite(null)} />
      <UseAsBaseModal site={baseSite} onOpenChange={(o) => !o && setBaseSite(null)} />
    </div>
  );
}
