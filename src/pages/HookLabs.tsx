import { errorMessage } from "@/lib/error-message";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Copy,
  Star,
  StarOff,
  Filter,
  Loader2,
  Wand2,
  Search,
  Brain,
  FileText,
  Cpu,
  UserCheck,
  Target,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HOOKS_LIBRARY, type HookTemplate } from "@/data/hooks/library";
import { useProjectList } from "@/hooks/useProjectList";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { loadProjectIntelligence, type ProjectIntelligenceBundle } from "@/lib/project-intelligence";
import { normalizeProjectIcon, SiteThumbnail } from "@/components/sites/SiteThumbnail";
import { DERICK_CANONICAL_G1_G25_HOOKS, gerarGanchoG1G25 } from "@/lib/derick-engines";

const OBJETIVOS = ["Parar o scroll", "Gerar clique", "Aquecer o lead", "Fechar a venda"] as const;

const FAV_KEY = "hooklabs_favs_v1";
const loadFavs = (): number[] => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
};

const objetivoColor: Record<string, string> = {
  "Parar o scroll": "bg-red-500/15 text-red-400 border-red-500/30",
  "Gerar clique": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Aquecer o lead": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Fechar a venda": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export default function HookLabs() {
  const [favs, setFavs] = useState<number[]>(loadFavs);
  const [objetivo, setObjetivo] = useState<string>("__all__");
  const [gatilho, setGatilho] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [portaDerick, setPortaDerick] = useState<string>("__all__");
  const { projectId: globalProjectId, setProjectId: setGlobalProjectId } = useGlobalProject();
  const [projectId, setProjectId] = useState<string>(globalProjectId || "__none__");
  const [selected, setSelected] = useState<HookTemplate | null>(null);
  const [gerando, setGerando] = useState(false);
  const [variacoes, setVariacoes] = useState<string[]>([]);
  const [novoOpen, setNovoOpen] = useState(false);
  const [novosHooks, setNovosHooks] = useState<Array<{ texto: string; motivo: string }>>([]);
  const [intel, setIntel] = useState<ProjectIntelligenceBundle | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const { data: projects = [] } = useProjectList();

  // Auto-select global project or first project so HookLabs always starts connected to a real project
  useEffect(() => {
    if (globalProjectId && globalProjectId !== projectId) {
      setProjectId(globalProjectId);
      return;
    }
    if ((projectId === "__none__" || !projectId) && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [globalProjectId, projects, projectId]);

  // Load full Project Intelligence (Project + Avatar + Docs + Skills + Sites)
  useEffect(() => {
    let cancelled = false;
    if (!projectId || projectId === "__none__") {
      setIntel(null);
      return;
    }
    setLoadingIntel(true);
    loadProjectIntelligence(projectId)
      .then((bundle) => {
        if (!cancelled) setIntel(bundle);
      })
      .finally(() => {
        if (!cancelled) setLoadingIntel(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleProjectChange = (nextId: string) => {
    setProjectId(nextId);
    if (nextId !== "__none__") {
      setGlobalProjectId(nextId);
    }
  };

  const gatilhos = useMemo(() => {
    const s = new Set<string>();
    HOOKS_LIBRARY.forEach((h) => s.add(h.gatilho));
    return Array.from(s).sort();
  }, []);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return HOOKS_LIBRARY.filter((h) => {
      if (objetivo !== "__all__" && h.objetivo !== objetivo) return false;
      if (gatilho && h.gatilho !== gatilho) return false;
      if (onlyFavs && !favs.includes(h.n)) return false;
      if (q && !h.texto.toLowerCase().includes(q) && !h.gatilho.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [objetivo, gatilho, busca, onlyFavs, favs]);

  const toggleFav = (n: number) => {
    const next = favs.includes(n) ? favs.filter((x) => x !== n) : [...favs, n];
    setFavs(next);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  };

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copiado para a área de transferência");
  };

  const buildLocalFillFallback = (h: HookTemplate, bundle: ProjectIntelligenceBundle | null): string[] => {
    if (!bundle) return [h.texto];
    const pain1 = bundle.deepPains[0] || "o sintoma que trava sua rotina";
    const pain2 = bundle.deepPains[1] || pain1;
    return [
      `[${bundle.avatarName}] ${h.texto.replace(/\[.*?\]/g, bundle.mechanismName)} — especialmente se você já tentou de tudo contra "${pain1}" e descobriu que o vilão real é ${bundle.enemy}.`,
      `Por que quem sofre com "${pain1}" nunca deveria aceitar ${bundle.enemy.toLowerCase()} (e como ${bundle.mechanismName} atua direto na causa-raiz em dias).`,
      `O que os especialistas não contam para ${bundle.avatarName} sobre "${pain2}": a virada começa quando você ativa ${bundle.mechanismName}.`,
      `Se "${pain1}" está tirando sua paz, pare de insistir no erro padrão. Veja como ${bundle.mechanismName} foi desenhado exatamente para ${bundle.externalDesire.toLowerCase()}.`,
      `[Baseado em ${bundle.docs[0]?.title || bundle.projectName}] "${bundle.synthesizedHooks[0]?.text || h.texto}"`,
    ];
  };

  const buildLocalGenerateFallback = (bundle: ProjectIntelligenceBundle | null): Array<{ texto: string; motivo: string }> => {
    if (!bundle) return [];
    return bundle.synthesizedHooks.map((sh) => ({
      texto: sh.text,
      motivo: `Ângulo: ${sh.angle} · Skill: ${sh.skillApplied} · Doc: ${sh.docReference} · Dor do Avatar (${bundle.avatarName}): ${sh.avatarPainTarget}`,
    }));
  };

  const preencher = async (h: HookTemplate) => {
    setSelected(h);
    setVariacoes([]);
    if (projectId === "__none__") {
      toast.error("Selecione um projeto para preencher com IA");
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("hook-generator", {
        body: {
          mode: "fill",
          project_id: projectId,
          template: h.texto,
          objetivo: h.objetivo,
          gatilho: h.gatilho,
          avatar_context: intel
            ? {
                nome: intel.avatarName,
                dores_profundas: intel.deepPains,
                desejo_externo: intel.externalDesire,
                desejo_interno: intel.internalDesire,
                inimigo: intel.enemy,
                gatilho_nuclear: intel.nuclearTrigger,
                mecanismo: intel.mechanismName,
              }
            : undefined,
          docs_context: intel?.docs.map((d) => ({ title: d.title, category: d.category, excerpt: d.excerpt })),
          skills_slugs: intel?.skills.map((s) => s.slug),
        },
      });
      if (error) throw error;
      const list = Array.isArray(data?.variacoes) && data.variacoes.length > 0 ? data.variacoes : buildLocalFillFallback(h, intel);
      setVariacoes(list);
    } catch (e: unknown) {
      const fallback = buildLocalFillFallback(h, intel);
      if (fallback.length > 0) {
        setVariacoes(fallback);
        toast.info("Ganchos gerados com o motor local de Avatar + Docs + Skills do projeto.");
      } else {
        toast.error(errorMessage(e) || "Falha ao preencher gancho");
      }
    } finally {
      setGerando(false);
    }
  };

  const gerarNovos = async () => {
    if (projectId === "__none__") {
      toast.error("Selecione um projeto");
      return;
    }
    setNovoOpen(true);
    setNovosHooks([]);
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("hook-generator", {
        body: {
          mode: "generate",
          project_id: projectId,
          objetivo: objetivo === "__all__" ? "Parar o scroll" : objetivo,
          gatilho: gatilho || "Curiosidade",
          quantidade: 10,
          avatar_context: intel
            ? {
                nome: intel.avatarName,
                dores_profundas: intel.deepPains,
                desejo_externo: intel.externalDesire,
                desejo_interno: intel.internalDesire,
                inimigo: intel.enemy,
                gatilho_nuclear: intel.nuclearTrigger,
                mecanismo: intel.mechanismName,
                ganchos_nativos: intel.avatarNativeHooks,
              }
            : undefined,
          docs_context: intel?.docs.map((d) => ({ title: d.title, category: d.category, excerpt: d.excerpt })),
          skills_slugs: intel?.skills.map((s) => s.slug),
        },
      });
      if (error) throw error;
      const list =
        Array.isArray(data?.hooks) && data.hooks.length > 0 ? data.hooks : buildLocalGenerateFallback(intel);
      setNovosHooks(list);
    } catch (e: unknown) {
      const fallback = buildLocalGenerateFallback(intel);
      if (fallback.length > 0) {
        setNovosHooks(fallback);
        toast.info("Ganchos sintetizados diretamente do Avatar + Documentos + Skills do projeto.");
      } else {
        toast.error(errorMessage(e) || "Falha ao gerar ganchos");
      }
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-4xl text-foreground flex items-center gap-3">
            <Sparkles className="h-9 w-9 text-primary" /> Hook Labs
          </h1>
          <p className="text-muted-foreground mt-1 leading-7">
            Motor de ganchos conectado ao <strong>Projeto</strong>, <strong>Avatar Psicológico</strong>,{" "}
            <strong>Documentos (`imphq_docs`)</strong> e <strong>Skills Ativas (`imphq_skills`)</strong> + 400 templates.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={projectId} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-64 border-primary/40 bg-secondary/60 font-medium">
              <SelectValue placeholder="Projeto (p/ IA)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem projeto específico</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {normalizeProjectIcon(p.icon)} {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={gerarNovos} className="bg-primary text-primary-foreground">
            <Wand2 className="h-4 w-4 mr-2" /> Gerar 10 Ganchos do Projeto
          </Button>
        </div>
      </div>

      {/* Painel de Inteligência Conectada (Projeto + Avatar + Docs + Skills + Páginas) */}
      {loadingIntel ? (
        <Card className="p-4 bg-secondary/30 border-primary/20 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Carregando Avatar, Documentos, Mecanismo Único e Skills conectadas ao projeto...
        </Card>
      ) : intel ? (
        <Card className="p-5 bg-gradient-to-br from-primary/10 via-secondary/50 to-background border-primary/30 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] uppercase tracking-wider">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Inteligência Ativa na Geração de Ganchos
                </Badge>
                <Badge variant="outline" className="border-primary/40 text-primary text-[11px]">
                  {intel.projectIcon} {intel.projectName}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Mecanismo: {intel.mechanismName}
                </Badge>
              </div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2 pt-1">
                <Brain className="h-4 w-4 text-primary" />
                Contexto Lido Automaticamente: Projeto + Avatar + {intel.docs.length} Documentos + {intel.skills.length} Skills
              </h2>
            </div>

            {intel.sites.length > 0 && (
              <div className="flex items-center gap-2">
                {intel.sites.slice(0, 2).map((site) => (
                  <div
                    key={site.id || site.url}
                    className="w-28 rounded-lg overflow-hidden border border-border/70 bg-background/60 shrink-0"
                    title={`${site.titulo} (${site.url})`}
                  >
                    <SiteThumbnail site={site} aspect="aspect-[16/9]" showBrowserBar={false} />
                    <div className="px-1.5 py-0.5 text-[9px] font-medium truncate text-muted-foreground">
                      {site.titulo}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3 colunas de contexto real */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Avatar Psicológico */}
            <div className="p-3 rounded-lg bg-background/60 border border-border/70 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" /> Avatar & Dores Profundas
              </div>
              <p className="text-xs font-semibold text-foreground">
                {intel.avatarName} <span className="text-muted-foreground font-normal">({intel.avatarAgeRange})</span>
              </p>
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                <strong>Inimigo:</strong> {intel.enemy}
              </p>
              <p className="text-[11px] text-amber-300/90 line-clamp-2">
                <strong>Gatilho Nuclear:</strong> {intel.nuclearTrigger}
              </p>
              <div className="pt-1 space-y-1">
                {intel.deepPains.slice(0, 3).map((pain, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <Flame className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{pain}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Documentos Lidos */}
            <div className="p-3 rounded-lg bg-background/60 border border-border/70 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Documentos Lidos (`imphq_docs`)
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {intel.docs.slice(0, 6).map((d) => (
                  <Badge
                    key={d.id}
                    variant="outline"
                    className={`text-[10px] max-w-full truncate ${
                      d.isProjectSpecific
                        ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                        : "bg-secondary/60 text-muted-foreground"
                    }`}
                    title={d.excerpt}
                  >
                    {d.isProjectSpecific ? "📌 " : "📄 "}
                    {d.title}
                  </Badge>
                ))}
              </div>
              {intel.docs[0] && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 pt-1 italic">
                  "{intel.docs[0].excerpt}"
                </p>
              )}
            </div>

            {/* Skills Aplicadas */}
            <div className="p-3 rounded-lg bg-background/60 border border-border/70 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" /> Skills Aplicadas (`imphq_skills`)
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {intel.skills.slice(0, 6).map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className="text-[10px] bg-purple-500/15 text-purple-300 border-purple-500/30"
                    title={s.description}
                  >
                    ⚡ {s.name}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Cada gancho abaixo cruza as dores de <strong>{intel.avatarName}</strong> com o mecanismo{" "}
                <strong>{intel.mechanismName}</strong> e os frameworks das skills ativas.
              </p>
            </div>
          </div>

          {/* Ganchos Nativos + Sintetizados do Projeto */}
          {intel.synthesizedHooks.length > 0 && (
            <div className="pt-2 border-t border-border/60 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Ganchos Extraídos e Sintetizados para {intel.projectName} ({intel.synthesizedHooks.length})
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Gerados a partir de `avatar.ganchos` + `dores_profundas` + `mecanismo_unico` + `imphq_docs` + `imphq_skills`
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {intel.synthesizedHooks.map((sh) => (
                  <div
                    key={sh.id}
                    className="p-3 rounded-lg bg-background/80 border border-primary/25 hover:border-primary/50 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/30">
                          {sh.angle}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          ⚡ {sh.skillApplied} · 📄 {sh.docReference}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground leading-relaxed">"{sh.text}"</p>
                      <p className="text-[11px] text-muted-foreground">
                        <strong>Dor Alvo:</strong> {sh.avatarPainTarget}
                      </p>
                      <p className="text-[11px] text-cyan-300/90">
                        <strong>Direção Visual (0-3s):</strong> {sh.visualDirection}
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/50">
                      <Button size="sm" variant="ghost" onClick={() => copy(sh.text)} className="h-7 text-[11px]">
                        <Copy className="h-3 w-3 mr-1" /> Copiar Gancho
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          preencher({
                            n: 999,
                            objetivo: "Parar o scroll",
                            gatilho: sh.angle,
                            texto: sh.text,
                          })
                        }
                        className="h-7 text-[11px] text-primary"
                      >
                        <Wand2 className="h-3 w-3 mr-1" /> Gerar 5 Variações IA
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {/* Catálogo Canônico de 25 Ganchos da Derick.AI (G1–G25 — NSL / VSL / Ads) */}
      <Card className="p-5 bg-gradient-to-br from-amber-500/10 via-secondary/40 to-background border-amber-500/30 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] uppercase tracking-wider">
                ⚡ Catálogo Canônico Derick.AI · G1–G25 (Skills escrever-nsl & escrever-anuncios)
              </Badge>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300">
                Lei 54 (Sem Entregar MS) + Leis 48–52 (Cadência Natural)
              </Badge>
            </div>
            <h2 className="text-base font-bold text-foreground">
              25 Arquétipos Canônicos de Gancho (`G1` a `G25`) Preenchidos Automaticamente com {intel ? intel.projectName : "Seu Projeto"}
            </h2>
          </div>

          <Select value={portaDerick} onValueChange={setPortaDerick}>
            <SelectTrigger className="w-72 border-amber-500/30 bg-background/80 text-xs">
              <SelectValue placeholder="Filtrar por Porta de Entrada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as 3 Portas (25 Ganchos G1–G25)</SelectItem>
              <SelectItem value="Porta 1 — Curiosidade & Segredo">Porta 1 — Curiosidade & Segredo</SelectItem>
              <SelectItem value="Porta 2 — Identificação & Dor Visceral">Porta 2 — Identificação & Dor Visceral</SelectItem>
              <SelectItem value="Porta 3 — Descoberta Científica & Mecanismo">Porta 3 — Descoberta Científica & Mecanismo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
          {DERICK_CANONICAL_G1_G25_HOOKS.filter((h) => portaDerick === "__all__" || h.porta === portaDerick).map((gh) => {
            const generated = gerarGanchoG1G25(gh, intel);
            return (
              <div
                key={gh.id}
                className="p-3.5 rounded-lg bg-background/85 border border-amber-500/25 hover:border-amber-500/50 transition-colors flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {gh.code} · {gh.nome}
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${objetivoColor[gh.objetivo] || ""}`}>
                      {gh.objetivo}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-amber-300/80 font-medium">{gh.porta} · {gh.gatilho}</p>
                  <p className="text-xs font-medium text-foreground leading-relaxed">
                    "{generated.textoPreenchido}"
                  </p>
                  <div className="p-2 rounded bg-secondary/50 border border-border/60 space-y-1">
                    <p className="text-[10px] text-emerald-300 font-semibold">
                      🔒 Variação Cega (Lei 54 — Oculta o MS para forçar o clique):
                    </p>
                    <p className="text-[11px] text-muted-foreground italic leading-snug">
                      "{generated.variacaoCurtaLei54}"
                    </p>
                  </div>
                  <p className="text-[10px] text-cyan-300/90">
                    🎬 <strong>Visual 0–3s:</strong> {gh.direcaoVisual}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground">
                    Mediana: {generated.medicao.mediana_palavras}w
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copy(generated.variacaoCurtaLei54)}
                      className="h-6 px-2 text-[10px] text-emerald-300"
                    >
                      <Copy className="h-3 w-3 mr-1" /> Lei 54
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copy(generated.textoPreenchido)}
                      className="h-6 px-2 text-[10px]"
                    >
                      <Copy className="h-3 w-3 mr-1" /> Completo
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 bg-secondary/40 border-border">
        <div className="flex gap-2 flex-wrap items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={objetivo} onValueChange={setObjetivo}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os objetivos</SelectItem>
              {OBJETIVOS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={gatilho || "__all__"} onValueChange={(v) => setGatilho(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Gatilho" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="__all__">Todos os gatilhos</SelectItem>
              {gatilhos.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nos 400 templates..." className="pl-8" />
          </div>
          <Button variant={onlyFavs ? "default" : "outline"} onClick={() => setOnlyFavs(!onlyFavs)} size="sm">
            <Star className="h-4 w-4 mr-1" /> Favoritos ({favs.length})
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} / {HOOKS_LIBRARY.length}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((h) => {
          const isFav = favs.includes(h.n);
          return (
            <Card
              key={h.n}
              className="p-4 bg-secondary/40 border-border hover:border-primary/40 transition-colors flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">#{String(h.n).padStart(3, "0")}</span>
                <Badge variant="outline" className={`text-[10px] ${objetivoColor[h.objetivo] || ""}`}>
                  {h.objetivo}
                </Badge>
              </div>
              <p className="text-sm text-foreground leading-6 flex-1">{h.texto}</p>
              <p className="text-[10px] text-primary/80 uppercase tracking-wide">{h.gatilho}</p>
              <div className="flex gap-1 pt-1 border-t border-border/60">
                <Button size="sm" variant="ghost" onClick={() => copy(h.texto)} className="h-7 text-[11px]">
                  <Copy className="h-3 w-3 mr-1" /> Copiar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => preencher(h)} className="h-7 text-[11px]">
                  <Wand2 className="h-3 w-3 mr-1" /> Preencher c/ Avatar IA
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleFav(h.n)} className="h-7 text-[11px] ml-auto">
                  {isFav ? <Star className="h-3 w-3 fill-primary text-primary" /> : <StarOff className="h-3 w-3" />}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Dialog Preencher */}
      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setVariacoes([]);
          }
        }}
      >
        <DialogContent className="bg-secondary/95 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              Preencher com IA ({intel?.projectName || "Projeto"}) · #{selected?.n}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {intel && (
              <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                  Avatar: {intel.avatarName}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Mecanismo: {intel.mechanismName}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {intel.docs.length} Docs + {intel.skills.length} Skills
                </Badge>
              </div>
            )}
            <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-3 leading-6">
              {selected?.texto}
            </p>
            {gerando && (
              <div className="text-center py-6">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
              </div>
            )}
            {variacoes.map((v, i) => (
              <div key={i} className="p-3 bg-background/60 rounded border border-border flex items-start gap-2">
                <p className="text-sm text-foreground leading-6 flex-1">{v}</p>
                <Button size="sm" variant="ghost" onClick={() => copy(v)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Novos */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="bg-secondary/95 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              Ganchos Originais · {intel ? `${intel.projectIcon} ${intel.projectName}` : "Seu Projeto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {intel && (
              <p className="text-xs text-muted-foreground">
                Criados lendo o avatar <strong>{intel.avatarName}</strong>, o mecanismo{" "}
                <strong>{intel.mechanismName}</strong>, <strong>{intel.docs.length} documentos</strong> e{" "}
                <strong>{intel.skills.length} skills</strong>.
              </p>
            )}
            {gerando && (
              <div className="text-center py-6">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
              </div>
            )}
            {novosHooks.map((h, i) => (
              <div key={i} className="p-3 bg-background/60 rounded border border-border">
                <div className="flex items-start gap-2">
                  <p className="text-sm text-foreground leading-6 flex-1">{h.texto}</p>
                  <Button size="sm" variant="ghost" onClick={() => copy(h.texto)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-[10px] text-primary/70 uppercase mt-1">{h.motivo}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
