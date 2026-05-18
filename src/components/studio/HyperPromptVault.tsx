import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Copy, FolderOpen, Loader2, Star, Search, CopyPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { HyperFields } from "@/lib/hyperPromptBuilder";

export interface SavedPrompt {
  id: string;
  nome: string;
  prompt_text: string;
  campos: HyperFields;
  tags: string[] | null;
  favorito: boolean | null;
  plataforma: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

export function HyperPromptVault({
  refreshKey,
  onLoad,
}: {
  refreshKey: number;
  onLoad: (fields: HyperFields) => void;
}) {
  const [items, setItems] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filtroPlataforma, setFiltroPlataforma] = useState<string>("__all__");
  const [somenteFavoritos, setSomenteFavoritos] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_prompts_salvos")
      .select("id, nome, prompt_text, campos, tags, favorito, plataforma, thumbnail_url, created_at")
      .order("favorito", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error("Erro ao carregar cofre");
    else setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const remove = async (id: string) => {
    const { error } = await supabase.from("imphq_prompts_salvos").delete().eq("id", id);
    if (error) return toast.error("Falha ao excluir");
    setItems((p) => p.filter((i) => i.id !== id));
    toast.success("Removido");
  };

  const toggleFav = async (p: SavedPrompt) => {
    const novo = !p.favorito;
    const { error } = await supabase
      .from("imphq_prompts_salvos")
      .update({ favorito: novo })
      .eq("id", p.id);
    if (error) return toast.error("Falha");
    setItems((arr) => arr.map((i) => (i.id === p.id ? { ...i, favorito: novo } : i)));
  };

  const duplicar = async (p: SavedPrompt) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Faça login");
    const { error } = await supabase.from("imphq_prompts_salvos").insert({
      user_id: user.id,
      nome: `${p.nome} (cópia)`,
      prompt_text: p.prompt_text,
      campos: p.campos as any,
      tags: p.tags,
      plataforma: p.plataforma,
    });
    if (error) return toast.error("Falha ao duplicar");
    toast.success("Duplicado");
    load();
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (somenteFavoritos && !p.favorito) return false;
      if (filtroPlataforma !== "__all__" && p.plataforma !== filtroPlataforma) return false;
      if (!q) return true;
      const tagStr = (p.tags || []).join(" ");
      return (
        p.nome.toLowerCase().includes(q) ||
        tagStr.toLowerCase().includes(q) ||
        p.prompt_text.toLowerCase().includes(q)
      );
    });
  }, [items, query, filtroPlataforma, somenteFavoritos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando cofre...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-secondary/20 border-border p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, tag ou conteúdo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-secondary/40 border-border"
          />
        </div>
        <Select value={filtroPlataforma} onValueChange={setFiltroPlataforma}>
          <SelectTrigger className="w-[180px] bg-secondary/40 border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas plataformas</SelectItem>
            <SelectItem value="midjourney">Midjourney</SelectItem>
            <SelectItem value="dalle">DALL·E</SelectItem>
            <SelectItem value="firefly">Firefly</SelectItem>
            <SelectItem value="sora">Sora</SelectItem>
            <SelectItem value="flux">Flux</SelectItem>
            <SelectItem value="generic">Genérico</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={somenteFavoritos ? "default" : "outline"}
          size="sm"
          onClick={() => setSomenteFavoritos((s) => !s)}
        >
          <Star className={`h-4 w-4 mr-1 ${somenteFavoritos ? "fill-current" : ""}`} />
          Favoritos
        </Button>
      </Card>

      {!filtered.length ? (
        <Card className="bg-secondary/20 border-border p-12 text-center">
          <p className="text-muted-foreground leading-7">
            {items.length === 0
              ? "Cofre vazio. Salve um prompt na aba Hyper."
              : "Nenhum prompt encontrado com esses filtros."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p) => (
            <Card key={p.id} className="bg-secondary/20 border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-display text-base font-bold text-primary truncate">{p.nome}</h4>
                    {p.plataforma && (
                      <Badge variant="outline" className="text-[10px] uppercase">{p.plataforma}</Badge>
                    )}
                  </div>
                  <p className="text-[11px] uppercase tracking-[1.5px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => toggleFav(p)} title="Favorito">
                    <Star className={`h-4 w-4 ${p.favorito ? "fill-primary text-primary" : ""}`} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onLoad(p.campos)} title="Carregar">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => duplicar(p)} title="Duplicar">
                    <CopyPlus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => copy(p.prompt_text)} title="Copiar">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)} title="Excluir">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {p.thumbnail_url && (
                <img
                  src={p.thumbnail_url}
                  alt={p.nome}
                  className="rounded border border-border w-full aspect-square object-cover"
                  loading="lazy"
                />
              )}
              <pre className="font-mono text-[11px] leading-6 text-foreground/70 whitespace-pre-wrap break-words line-clamp-6">
                {p.prompt_text}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
