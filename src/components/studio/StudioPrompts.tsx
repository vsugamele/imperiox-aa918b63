import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Copy, Star, Pencil, Trash2, Plus, Upload, Search, Loader2 } from "lucide-react";
import { PromptEditorDialog } from "./PromptEditorDialog";
import cartomantesSeed from "@/data/studio/cartomantes-prompts.json";

export interface StudioPrompt {
  id: string;
  nicho: string;
  codigo: string | null;
  titulo: string;
  idade: string | null;
  genero: string | null;
  nivel: string;
  prompt_especifico: string;
  prompt_negativo: string | null;
  dicas: string | null;
  tags: string[] | null;
  ordem: number | null;
}

const NIVEIS = ["Padrão", "Hot", "Ultra Hot"] as const;

const nivelColor = (n: string) => {
  if (n === "Hot") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  if (n === "Ultra Hot") return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
};

export function StudioPrompts() {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<StudioPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");
  const [nivel, setNivel] = useState<string>("__all__");
  const [genero, setGenero] = useState<string>("__all__");
  const [nicho, setNicho] = useState<string>("__all__");
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<StudioPrompt | null>(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_studio_prompts")
      .select("*")
      .order("nicho")
      .order("ordem", { ascending: true });
    if (error) toast.error("Erro carregando prompts: " + error.message);
    setPrompts((data as StudioPrompt[]) || []);
    setLoading(false);
  }

  async function loadFavoritos() {
    if (!user) return;
    const { data } = await supabase
      .from("imphq_studio_user_state")
      .select("entity_id, state")
      .eq("user_id", user.id)
      .eq("entity_type", "prompt");
    const favs = new Set<string>();
    (data || []).forEach((r: any) => {
      if (r.state?.favorito) favs.add(r.entity_id);
    });
    setFavoritos(favs);
  }

  async function checkAdmin() {
    if (!user) return;
    const { data } = await supabase.rpc("is_imphq_admin", { _user_id: user.id });
    setIsAdmin(!!data);
  }

  useEffect(() => {
    load();
    loadFavoritos();
    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function toggleFav(id: string) {
    if (!user) return;
    const isFav = favoritos.has(id);
    const next = new Set(favoritos);
    if (isFav) next.delete(id);
    else next.add(id);
    setFavoritos(next);
    await supabase.from("imphq_studio_user_state").upsert(
      {
        user_id: user.id,
        entity_type: "prompt",
        entity_id: id,
        state: { favorito: !isFav },
      },
      { onConflict: "user_id,entity_type,entity_id" },
    );
  }

  async function copyPrompt(p: StudioPrompt) {
    await navigator.clipboard.writeText(p.prompt_especifico);
    toast.success(`"${p.titulo}" copiado!`);
  }

  async function deletePrompt(p: StudioPrompt) {
    if (!confirm(`Apagar "${p.titulo}"?`)) return;
    const { error } = await supabase.from("imphq_studio_prompts").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Prompt apagado");
    load();
  }

  async function importarSeedCartomantes() {
    if (!isAdmin) return toast.error("Apenas admins podem importar.");
    if (!confirm(`Importar ${cartomantesSeed.prompts.length} prompts de cartomantes? (duplicados serão ignorados)`))
      return;
    setSeeding(true);
    const existing = new Set(
      prompts.filter((p) => p.nicho === "cartomantes").map((p) => `${p.codigo}|${p.titulo}`),
    );
    const rows = cartomantesSeed.prompts
      .filter((p: any) => !existing.has(`${p.id}|${p.titulo}`))
      .map((p: any, i: number) => ({
        nicho: "cartomantes",
        codigo: p.id,
        titulo: p.titulo,
        idade: p.idade,
        genero: p.genero,
        nivel: p.nivel,
        prompt_especifico: p.prompt_especifico,
        ordem: i,
      }));
    if (!rows.length) {
      toast.info("Nada novo para importar.");
      setSeeding(false);
      return;
    }
    const { error } = await supabase.from("imphq_studio_prompts").insert(rows);
    if (error) toast.error(error.message);
    else toast.success(`${rows.length} prompts importados!`);
    setSeeding(false);
    load();
  }

  const nichos = useMemo(
    () => Array.from(new Set(prompts.map((p) => p.nicho))).sort(),
    [prompts],
  );

  const filtered = useMemo(() => {
    return prompts.filter((p) => {
      if (nicho !== "__all__" && p.nicho !== nicho) return false;
      if (nivel !== "__all__" && p.nivel !== nivel) return false;
      if (genero !== "__all__" && (p.genero || "").indexOf(genero) === -1) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.titulo.toLowerCase().includes(q) &&
          !(p.codigo || "").toLowerCase().includes(q) &&
          !p.prompt_especifico.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [prompts, search, nivel, genero, nicho]);

  const counts = useMemo(() => {
    const base = nicho === "__all__" ? prompts : prompts.filter((p) => p.nicho === nicho);
    return {
      total: base.length,
      padrao: base.filter((p) => p.nivel === "Padrão").length,
      hot: base.filter((p) => p.nivel === "Hot").length,
      ultra: base.filter((p) => p.nivel === "Ultra Hot").length,
    };
  }, [prompts, nicho]);

  return (
    <div className="space-y-4">
      {/* Header counters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-sm">
          <Stat label="Total" value={counts.total} color="text-primary" />
          <Stat label="Padrão" value={counts.padrao} color="text-emerald-400" />
          <Stat label="Hot" value={counts.hot} color="text-rose-400" />
          <Stat label="Ultra Hot" value={counts.ultra} color="text-orange-400" />
        </div>
        <div className="flex gap-2">
          {isAdmin && prompts.length === 0 && (
            <Button onClick={importarSeedCartomantes} disabled={seeding} variant="default">
              {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar 42 prompts (cartomantes)
            </Button>
          )}
          {isAdmin && prompts.length > 0 && (
            <Button onClick={importarSeedCartomantes} disabled={seeding} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Re-importar seed
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-2" /> Novo prompt
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-secondary/30 border-border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar título, código ou texto do prompt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ToggleGroup type="single" value={nivel} onValueChange={(v) => setNivel(v || "__all__")}>
            <ToggleGroupItem value="__all__">Todos</ToggleGroupItem>
            {NIVEIS.map((n) => (
              <ToggleGroupItem key={n} value={n}>
                {n}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <ToggleGroup type="single" value={genero} onValueChange={(v) => setGenero(v || "__all__")}>
            <ToggleGroupItem value="__all__">Todos</ToggleGroupItem>
            <ToggleGroupItem value="♀">♀</ToggleGroupItem>
            <ToggleGroupItem value="♂">♂</ToggleGroupItem>
          </ToggleGroup>

          {nichos.length > 1 && (
            <ToggleGroup type="single" value={nicho} onValueChange={(v) => setNicho(v || "__all__")}>
              <ToggleGroupItem value="__all__">Nichos</ToggleGroupItem>
              {nichos.map((n) => (
                <ToggleGroupItem key={n} value={n} className="capitalize">
                  {n}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {prompts.length === 0
            ? "Nenhum prompt ainda. Use 'Importar 42 prompts' acima para começar."
            : "Nenhum resultado para os filtros atuais."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const isExp = expanded.has(p.id);
            const isFav = favoritos.has(p.id);
            return (
              <Card key={p.id} className="p-4 bg-secondary/30 border-border flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      {p.codigo && <span className="font-mono">{p.codigo}</span>}
                      {p.idade && <span>· {p.idade}</span>}
                      {p.genero && <span>· {p.genero}</span>}
                    </div>
                    <h3 className="font-display text-lg leading-tight text-foreground">{p.titulo}</h3>
                  </div>
                  <Badge variant="outline" className={nivelColor(p.nivel)}>
                    {p.nivel}
                  </Badge>
                </div>

                <div
                  className={`text-xs text-muted-foreground/90 leading-6 whitespace-pre-wrap font-mono ${
                    isExp ? "" : "line-clamp-4"
                  } cursor-pointer`}
                  onClick={() => {
                    const next = new Set(expanded);
                    isExp ? next.delete(p.id) : next.add(p.id);
                    setExpanded(next);
                  }}
                >
                  {p.prompt_especifico}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <Button size="sm" variant="default" onClick={() => copyPrompt(p)} className="flex-1">
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
                  </Button>
                  <Button
                    size="sm"
                    variant={isFav ? "default" : "outline"}
                    onClick={() => toggleFav(p.id)}
                    className={isFav ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-amber-500/40" : ""}
                  >
                    <Star className={`h-3.5 w-3.5 ${isFav ? "fill-current" : ""}`} />
                  </Button>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deletePrompt(p)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PromptEditorDialog
        open={creating || !!editing}
        prompt={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSaved={() => {
          load();
          setEditing(null);
          setCreating(false);
        }}
        nichosExistentes={nichos}
      />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`font-display text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}
