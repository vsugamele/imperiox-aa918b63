import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, X, Wand2, Image as ImageIcon, Target, Palette, Compass } from "lucide-react";
import { toast } from "sonner";
import { CreativeMatrix } from "@/components/studio/CreativeMatrix";
import { CREATIVE_ANGLES } from "@/data/creativeAngles";

const ANGULOS = CREATIVE_ANGLES.map((a) => ({ value: a.slug, label: a.nome }));

const AVATAR_PRINCIPAL = "__principal__";

interface Projeto {
  id: string;
  name: string;
  avatar: any;
  brand_kit: any;
  data: any;
}

interface ExpertFoto {
  id: string;
  url: string;
  title: string;
}

interface Concorrente {
  id: string;
  name: string;
  url: string;
  score_escala: number | null;
}

export default function CriativoNovo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourceSwipeId = searchParams.get("source_swipe");
  const [sourceSwipe, setSourceSwipe] = useState<any>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(false);

  const [projectId, setProjectId] = useState<string>("");
  const [selectedProductIdx, setSelectedProductIdx] = useState<string>(AVATAR_PRINCIPAL);
  const [autoMode, setAutoMode] = useState(true);
  const [showMatrix, setShowMatrix] = useState(false);

  const [nome, setNome] = useState("");
  const [produto, setProduto] = useState("");
  const [publico, setPublico] = useState("");
  const [dor, setDor] = useState("");
  const [desejo, setDesejo] = useState("");
  const [mecanismo, setMecanismo] = useState("");
  const [extras, setExtras] = useState("");
  const [formato, setFormato] = useState("1:1");
  const [variacoes, setVariacoes] = useState(2);
  const [imageProvider, setImageProvider] = useState<"lovable-gemini" | "openai-image">("lovable-gemini");
  const [angulos, setAngulos] = useState<string[]>(["dor", "desejo", "prova", "curiosidade"]);
  const [referenciasText, setReferenciasText] = useState("");
  const [expertFotos, setExpertFotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Pré-carrega VSL de origem se ?source_swipe=ID
  useEffect(() => {
    if (!sourceSwipeId) return;
    supabase
      .from("imphq_swipes" as any)
      .select("id, title, raw_text, media_urls, project_id, blocks, criador")
      .eq("id", sourceSwipeId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!data) return;
        setSourceSwipe(data);
        if (data.project_id) setProjectId(data.project_id);
        setNome((n) => n || `Inspirado em: ${data.title}`);
        setExtras((x) => x || `Inspiração (VSL): ${data.title}\n${data.blocks?.gancho ? "Hook: " + data.blocks.gancho + "\n" : ""}${(data.raw_text || "").slice(0, 800)}`);
        if (data.media_urls?.[0]) {
          setReferenciasText((r) => (r ? r + "\n" : "") + data.media_urls[0]);
        }
      });
  }, [sourceSwipeId]);

  // Project context
  const [expertLibrary, setExpertLibrary] = useState<ExpertFoto[]>([]);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());
  const [concorrentes, setConcorrentes] = useState<Concorrente[]>([]);
  const [selectedConcorrentes, setSelectedConcorrentes] = useState<Set<string>>(new Set());

  const currentProject = useMemo(() => projetos.find((p) => p.id === projectId), [projetos, projectId]);
  const produtos: any[] = currentProject?.data?.produtos || [];

  const currentAvatar = useMemo(() => {
    if (!currentProject) return null;
    if (selectedProductIdx === AVATAR_PRINCIPAL) return currentProject.avatar || {};
    const map = currentProject.data?.avatars_por_produto || {};
    return map[selectedProductIdx] || {};
  }, [currentProject, selectedProductIdx]);

  const currentProduct = useMemo(() => {
    if (selectedProductIdx === AVATAR_PRINCIPAL) return null;
    return produtos[Number(selectedProductIdx)] || null;
  }, [selectedProductIdx, produtos]);

  // Load projects
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imphq_projects")
        .select("id, name, avatar, brand_kit, data")
        .order("name", { ascending: true });
      setProjetos((data as Projeto[]) || []);
    })();
    // Pré-preenche extras se veio do Hyper Prompt Generator
    try {
      const fromHyper = sessionStorage.getItem("criativo:promptVisual");
      const previewUrl = sessionStorage.getItem("criativo:previewUrl");
      if (fromHyper) {
        const block =
          "[PROMPT VISUAL]\n" + fromHyper +
          (previewUrl ? `\n\n[PREVIEW]\n${previewUrl}` : "");
        setExtras((prev) => (prev ? prev + "\n\n" : "") + block);
        sessionStorage.removeItem("criativo:promptVisual");
        sessionStorage.removeItem("criativo:previewUrl");
        toast.success("Prompt visual carregado nos Extras");
      }
    } catch {}
  }, []);

  // Load project-scoped resources when project changes
  useEffect(() => {
    if (!projectId) {
      setExpertLibrary([]);
      setConcorrentes([]);
      setSelectedLibraryIds(new Set());
      setSelectedConcorrentes(new Set());
      return;
    }
    (async () => {
      const [libRes, compRes] = await Promise.all([
        supabase
          .from("imphq_content_library")
          .select("id, title, file_url, file_type, tags")
          .eq("project_id", projectId)
          .eq("file_type", "image")
          .limit(60)
          .order("created_at", { ascending: false }),
        supabase
          .from("imphq_competitors")
          .select("id, name, url, score_escala")
          .eq("project_id", projectId)
          .order("score_escala", { ascending: false, nullsFirst: false })
          .limit(10),
      ]);
      const libImages: ExpertFoto[] = ((libRes.data as any[]) || [])
        .filter((r) => {
          const tags: string[] = r.tags || [];
          return tags.some((t) => /expert|rosto|pessoa|self/i.test(t)) || /expert|self/i.test(r.title || "");
        })
        .map((r) => ({ id: r.id, url: r.file_url, title: r.title || "Expert" }));
      // fallback: if zero "expert"-tagged, just expose latest 12 images so user can pick
      const fallback: ExpertFoto[] =
        libImages.length === 0
          ? ((libRes.data as any[]) || []).slice(0, 12).map((r) => ({ id: r.id, url: r.file_url, title: r.title || "Imagem" }))
          : libImages;
      setExpertLibrary(fallback);
      setConcorrentes((compRes.data as Concorrente[]) || []);
      setSelectedProductIdx(AVATAR_PRINCIPAL);
    })();
  }, [projectId]);

  // Auto-fill from project + avatar + product when source changes
  useEffect(() => {
    if (!currentProject) return;
    const briefing = currentProject.data?.briefing || {};
    const brandKit = currentProject.brand_kit || {};
    const avatar = currentAvatar || {};
    const perfil = avatar.perfil_psicologico || {};

    // Top dores/desejos from avatar arrays (if exist)
    const doresArr: any[] = avatar.dores || [];
    const desejosArr: any[] = avatar.desejos || [];
    const topDor = doresArr[0]?.descricao || doresArr[0]?.text || avatar.dor_principal || perfil.ferida_central || "";
    const topDesejo =
      desejosArr[0]?.descricao || desejosArr[0]?.text || avatar.desejo_externo || avatar.resultado_sonhado || "";

    const novoProduto =
      currentProduct?.nome ||
      currentProduct?.name ||
      briefing.produto ||
      currentProject.name ||
      "";
    const novoPublico = avatar.publico || perfil.retrato || briefing.publico_alvo || "";
    const novoMecanismo = currentProduct?.mecanismo || avatar.mecanismo_unico || brandKit.mecanismo_unico || "";

    setProduto(novoProduto);
    setPublico(novoPublico);
    setDor(topDor);
    setDesejo(topDesejo);
    setMecanismo(novoMecanismo);

    // Branding → extras
    const cores = brandKit.cores || brandKit.paleta || [];
    const arquetipo = brandKit.arquetipo || "";
    const tom = brandKit.tom_voz || brandKit.tom || "";
    const hintsBrand = [
      arquetipo && `arquétipo ${arquetipo}`,
      tom && `tom ${tom}`,
      Array.isArray(cores) && cores.length > 0 && `paleta ${cores.slice(0, 3).join(", ")}`,
    ]
      .filter(Boolean)
      .join("; ");
    setExtras(hintsBrand);

    // Pre-fill nome do batch
    if (novoProduto && !nome) {
      setNome(`${novoProduto} — ${new Date().toLocaleDateString("pt-BR")}`);
    }
  }, [currentProject, currentAvatar, currentProduct]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selected library photos into expertFotos URLs
  useEffect(() => {
    const urls = expertLibrary.filter((p) => selectedLibraryIds.has(p.id)).map((p) => p.url);
    setExpertFotos((prev) => {
      // keep manual uploads (not in library) + selected library urls
      const libraryAll = new Set(expertLibrary.map((p) => p.url));
      const manual = prev.filter((u) => !libraryAll.has(u));
      return [...manual, ...urls];
    });
  }, [selectedLibraryIds, expertLibrary]);

  // Sync selected concorrentes into referencias
  useEffect(() => {
    const urls = concorrentes.filter((c) => selectedConcorrentes.has(c.id)).map((c) => c.url).filter(Boolean);
    if (urls.length > 0) {
      setReferenciasText((prev) => {
        const lines = prev.split(/\s+/).filter((s) => s.startsWith("http"));
        const merged = Array.from(new Set([...lines, ...urls])).slice(0, 3);
        return merged.join("\n");
      });
    }
  }, [selectedConcorrentes, concorrentes]);

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        toast.error("Faça login");
        return;
      }
      const uploaded: string[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop() || "jpg";
        const path = `${uid}/expert-fotos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("creative-assets").upload(path, f);
        if (error) {
          toast.error(error.message);
          continue;
        }
        const { data } = supabase.storage.from("creative-assets").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      setExpertFotos((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  function toggleAngulo(a: string) {
    setAngulos((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  function toggleLibrary(id: string) {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleConcorrente(id: string) {
    setSelectedConcorrentes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pullDor(text: string) {
    setDor(text);
  }
  function pullDesejo(text: string) {
    setDesejo(text);
  }

  async function handleSubmit() {
    if (!projectId) return toast.error("Selecione um projeto");
    if (!autoMode && !produto.trim()) return toast.error("Descreva o produto ou ative Modo Automático");
    if (angulos.length === 0) return toast.error("Escolha pelo menos 1 ângulo");

    setLoading(true);
    try {
      const referencias_urls = referenciasText
        .split(/\s+/)
        .filter((s) => s.startsWith("http"))
        .slice(0, 3);

      // Auto-briefing: build a richer briefing from project context if mode = automático
      const avatar = currentAvatar || {};
      const perfil = avatar.perfil_psicologico || {};
      const brandKit = currentProject?.brand_kit || {};

      const briefing = autoMode
        ? {
            produto: produto || currentProduct?.nome || currentProject?.name || "",
            publico: publico || perfil.retrato || "",
            dor: dor || avatar.dor_principal || perfil.ferida_central || "",
            desejo: desejo || avatar.desejo_externo || avatar.resultado_sonhado || "",
            mecanismo: mecanismo || brandKit.mecanismo_unico || "",
            extras,
            ticket: currentProduct?.preco || currentProduct?.ticket || null,
            promessa: currentProduct?.promessa || avatar.epifania_central || "",
            arquetipo: brandKit.arquetipo || "",
            tom_voz: brandKit.tom_voz || brandKit.tom || "",
            paleta: brandKit.cores || brandKit.paleta || [],
            inimigo: avatar.inimigo || "",
            crenca_necessaria: avatar.crenca_necessaria || "",
            variacoes_por_angulo: variacoes,
            image_provider: imageProvider,
            auto_briefing: true,
          }
        : {
            produto,
            publico,
            dor,
            desejo,
            mecanismo,
            extras,
            variacoes_por_angulo: variacoes,
            image_provider: imageProvider,
          };

      const { data, error } = await supabase.functions.invoke("creative-factory", {
        body: {
          project_id: projectId,
          product_id: selectedProductIdx === AVATAR_PRINCIPAL ? null : selectedProductIdx,
          nome: nome || `${produto || currentProject?.name} — ${new Date().toLocaleDateString("pt-BR")}`,
          briefing,
          referencias_urls,
          expert_fotos: expertFotos,
          angulos,
          formato,
          auto_briefing: autoMode,
          source_swipe_ids: sourceSwipeId ? [sourceSwipeId] : [],
        },
      });
      if (error) throw error;
      if (sourceSwipeId && (data as any)?.batch_id) {
        await supabase
          .from("imphq_creative_batches")
          .update({ source_swipe_ids: [sourceSwipeId] } as any)
          .eq("id", (data as any).batch_id);
      }
      toast.success("Geração iniciada! Acompanhe em tempo real.");
      navigate(`/criativos/${(data as any).batch_id}`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao iniciar");
    } finally {
      setLoading(false);
    }
  }

  const total = angulos.length * variacoes;
  const custoEstimado = (total * 0.04).toFixed(2);

  // Top dores/desejos chips
  const doresChips: string[] = useMemo(() => {
    const arr: any[] = currentAvatar?.dores || [];
    return arr.slice(0, 3).map((d) => d.descricao || d.text || "").filter(Boolean);
  }, [currentAvatar]);
  const desejosChips: string[] = useMemo(() => {
    const arr: any[] = currentAvatar?.desejos || [];
    return arr.slice(0, 3).map((d) => d.descricao || d.text || "").filter(Boolean);
  }, [currentAvatar]);

  const hasAvatar = !!(currentAvatar && (currentAvatar.perfil_psicologico || currentAvatar.desejo_externo || (currentAvatar.dores || []).length));
  const hasBrand = !!(currentProject?.brand_kit && (currentProject.brand_kit.arquetipo || currentProject.brand_kit.cores || currentProject.brand_kit.tom_voz));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {sourceSwipe && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          <div className="text-xs flex-1">
            <p className="text-amber-300 font-semibold">Inspirado em VSL</p>
            <p className="text-muted-foreground">{sourceSwipe.title}</p>
          </div>
          <Button asChild size="sm" variant="ghost" className="text-amber-400 hover:text-amber-300">
            <a href="/swipe">Ver VSL</a>
          </Button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-primary flex items-center gap-2">
            <Sparkles className="h-7 w-7" /> Novo batch de criativos
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure o briefing e deixe a IA gerar {total} imagens em múltiplos ângulos.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setShowMatrix(!showMatrix)}
          className="gap-2 shrink-0 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary self-start sm:self-center"
        >
          <Compass className="h-4 w-4" /> 
          {showMatrix ? "Fechar Matriz de Ângulos" : "💡 Matriz de Copys & Ângulos"}
        </Button>
      </div>

      {showMatrix && (
        <div className="animate-fade-in">
          <CreativeMatrix 
            onSelectAngle={(key, text) => {
              if (key.includes("dor") || key.includes("sintoma") || key.includes("causa") || key.includes("custo")) {
                setDor(text);
                toast.success("Copiado para o campo de Dor Principal!");
              } else {
                setDesejo(text);
                toast.success("Copiado para o campo de Desejo!");
              }
            }}
          />
        </div>
      )}

      <Card className="p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Projeto *</Label>
            <Select value={projectId || undefined} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Avatar / Produto</Label>
            <Select value={selectedProductIdx} onValueChange={setSelectedProductIdx} disabled={!projectId}>
              <SelectTrigger>
                <SelectValue placeholder="Avatar do projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AVATAR_PRINCIPAL}>Avatar Principal</SelectItem>
                {produtos.map((p, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {p.nome || `Produto ${i + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {projectId && (
          <div className="flex flex-wrap gap-2">
            {hasAvatar && (
              <Badge variant="secondary" className="gap-1">
                <Target className="h-3 w-3" /> Avatar carregado
              </Badge>
            )}
            {hasBrand && (
              <Badge variant="secondary" className="gap-1">
                <Palette className="h-3 w-3" /> Branding aplicado
              </Badge>
            )}
            {expertLibrary.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <ImageIcon className="h-3 w-3" /> {expertLibrary.length} fotos disponíveis
              </Badge>
            )}
            {concorrentes.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                {concorrentes.length} concorrentes mapeados
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
          <div className="flex items-start gap-3">
            <Wand2 className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <div className="text-sm font-medium">Modo Automático</div>
              <p className="text-xs text-muted-foreground">
                A IA monta o briefing sozinha usando Avatar, Branding e Produto. Você só revisa.
              </p>
            </div>
          </div>
          <Switch checked={autoMode} onCheckedChange={setAutoMode} />
        </div>

        <div>
          <Label>Nome do batch (opcional)</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Lançamento Black Friday" />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Briefing</h3>
          {autoMode && (
            <span className="text-xs text-muted-foreground">Auto-preenchido — edite se quiser</span>
          )}
        </div>
        <div>
          <Label>Produto / Oferta {!autoMode && "*"}</Label>
          <Input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex: Curso Método X" />
        </div>
        <div>
          <Label>Público-alvo</Label>
          <Input value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="Ex: Mulheres 30-45 empreendedoras" />
        </div>

        {(doresChips.length > 0 || desejosChips.length > 0) && (
          <div className="grid md:grid-cols-2 gap-3 p-3 rounded-md bg-muted/30 border">
            {doresChips.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Top dores do avatar</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {doresChips.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pullDor(d)}
                      className="text-xs px-2 py-1 rounded bg-background border hover:border-primary text-left max-w-full truncate"
                      title="Clique para usar"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {desejosChips.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Top desejos do avatar</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {desejosChips.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pullDesejo(d)}
                      className="text-xs px-2 py-1 rounded bg-background border hover:border-primary text-left max-w-full truncate"
                      title="Clique para usar"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Dor principal</Label>
            <Textarea value={dor} onChange={(e) => setDor(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Desejo / Transformação</Label>
            <Textarea value={desejo} onChange={(e) => setDesejo(e.target.value)} rows={2} />
          </div>
        </div>
        <div>
          <Label>Mecanismo único (como funciona)</Label>
          <Textarea value={mecanismo} onChange={(e) => setMecanismo(e.target.value)} rows={2} />
        </div>
        <div>
          <Label>Direções extras (estilo, cores, elementos)</Label>
          <Textarea value={extras} onChange={(e) => setExtras(e.target.value)} rows={2} placeholder="Ex: paleta dourada, estilo editorial, fundo luxo" />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-medium">Fotos do expert</h3>
        <p className="text-sm text-muted-foreground">
          Selecione fotos já salvas no projeto ou faça upload. A IA usa como referência visual da pessoa.
        </p>

        {expertLibrary.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">Da biblioteca do projeto</Label>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2 mt-1">
              {expertLibrary.map((p) => {
                const sel = selectedLibraryIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleLibrary(p.id)}
                    className={`relative aspect-square rounded overflow-hidden border-2 transition ${
                      sel ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"
                    }`}
                  >
                    <img src={p.url} alt={p.title} className="w-full h-full object-cover" />
                    {sel && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Checkbox checked className="bg-background" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs text-muted-foreground">Ou faça upload</Label>
          <input type="file" multiple accept="image/*" onChange={handleFotoUpload} disabled={uploading} className="block mt-1 text-sm" />
          {uploading && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
        </div>

        {expertFotos.length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">Selecionadas ({expertFotos.length})</Label>
            <div className="grid grid-cols-6 gap-2 mt-1">
              {expertFotos.map((url, i) => (
                <div key={i} className="relative aspect-square">
                  <img src={url} alt="" className="w-full h-full object-cover rounded" />
                  <button
                    onClick={() => {
                      setExpertFotos((prev) => prev.filter((_, j) => j !== i));
                      // also remove from library selection if applicable
                      const libMatch = expertLibrary.find((p) => p.url === url);
                      if (libMatch) {
                        setSelectedLibraryIds((prev) => {
                          const next = new Set(prev);
                          next.delete(libMatch.id);
                          return next;
                        });
                      }
                    }}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-medium">Ângulos e formato</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ANGULOS.map((a) => (
            <label
              key={a.value}
              className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-accent/50"
            >
              <Checkbox checked={angulos.includes(a.value)} onCheckedChange={() => toggleAngulo(a.value)} />
              <span className="text-sm">{a.label}</span>
            </label>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Provider de imagem</Label>
            <Select value={imageProvider} onValueChange={(v) => setImageProvider(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable-gemini">Gemini Nano Banana (rápido, padrão)</SelectItem>
                <SelectItem value="openai-image">OpenAI gpt-image-1 (foto-realismo)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1 leading-4">
              {imageProvider === "openai-image"
                ? "Foto-realismo top + texto legível. Custo direto na sua conta OpenAI (~$0.04–0.19/imagem, fora do billing Lovable). Não usa fotos do expert como referência visual."
                : "Padrão Imperio HQ — gratuito via Lovable AI Gateway. Usa fotos do expert como referência."}
            </p>
          </div>
          <div>
            <Label>Formato</Label>
            <Select value={formato} onValueChange={setFormato}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">1:1 Quadrado (Feed)</SelectItem>
                <SelectItem value="4:5">4:5 Retrato (Feed)</SelectItem>
                <SelectItem value="9:16">9:16 Stories/Reels</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Variações por ângulo</Label>
            <Select value={String(variacoes)} onValueChange={(v) => setVariacoes(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-medium">Referências (opcional)</h3>
        <p className="text-sm text-muted-foreground">
          Cole até 3 URLs ou selecione concorrentes do projeto.
        </p>

        {concorrentes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {concorrentes.map((c) => {
              const sel = selectedConcorrentes.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleConcorrente(c.id)}
                  disabled={!c.url}
                  className={`text-xs px-2 py-1 rounded border transition ${
                    sel ? "bg-primary/10 border-primary text-primary" : "bg-background hover:border-primary/40"
                  } ${!c.url ? "opacity-50 cursor-not-allowed" : ""}`}
                  title={c.url || "sem URL"}
                >
                  {c.name} {c.score_escala ? `· ${c.score_escala}` : ""}
                </button>
              );
            })}
          </div>
        )}

        <Textarea
          value={referenciasText}
          onChange={(e) => setReferenciasText(e.target.value)}
          rows={3}
          placeholder="https://exemplo.com/anuncio1&#10;https://exemplo.com/anuncio2"
        />
      </Card>

      <div className="sticky bottom-4 bg-background/90 backdrop-blur border rounded-lg p-4 flex items-center justify-between">
        <div className="text-sm">
          <div>
            <span className="font-medium">{total}</span> imagens serão geradas
          </div>
          <div className="text-xs text-muted-foreground">Custo estimado: ~${custoEstimado}</div>
        </div>
        <Button onClick={handleSubmit} disabled={loading} size="lg">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Gerar criativos
        </Button>
      </div>
    </div>
  );
}
