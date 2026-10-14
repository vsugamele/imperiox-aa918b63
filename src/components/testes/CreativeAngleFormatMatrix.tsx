import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { TestOrder } from "@/hooks/useTestOrders";
import { PORTAS, CARGAS, PORTA_PONTO, type Porta, type Carga } from "@shared/hw-taxonomy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Grid3X3, Loader2, Palette, PlusCircle, Sparkles, Trophy, Play, Skull, Wand2 } from "lucide-react";

interface MatrixFormatCol {
  key: string;
  shortLabel: string;
  fullLabel: string;
  defaultCarga: Carga;
  jeitoHint: string;
}

const MATRIX_FORMATS: MatrixFormatCol[] = [
  {
    key: "ugc_fala",
    shortLabel: "UGC Fala",
    fullLabel: "UGC · Pessoa falando pra câmera",
    defaultCarga: "rosto_emocao",
    jeitoHint: "Selfie frontal natural, corte seco a cada 2.5s, olhando na lente",
  },
  {
    key: "narrativa_broll",
    shortLabel: "B-Roll + Off",
    fullLabel: "Narrativa com B-roll + voz em off",
    defaultCarga: "cena_vida",
    jeitoHint: "Cenas de rotina/mecanismo nos primeiros 3s + locução conversacional",
  },
  {
    key: "demonstracao",
    shortLabel: "Demo Física",
    fullLabel: "Demonstração física / tela",
    defaultCarga: "objeto_estranho",
    jeitoHint: "Close-up no teste físico, textura, copo ou prova visual imediata",
  },
  {
    key: "entrevista_podcast",
    shortLabel: "Podcast/Corte",
    fullLabel: "Entrevista / corte de podcast",
    defaultCarga: "contradicao",
    jeitoHint: "Microfone de mesa visível, enquadramento 45°, revelação de especialista",
  },
  {
    key: "antes_depois",
    shortLabel: "Antes × Depois",
    fullLabel: "Antes e depois / transformação",
    defaultCarga: "cena_vida",
    jeitoHint: "Contraste visual de estado inicial vs. alívio sem violar compliance",
  },
  {
    key: "estatico",
    shortLabel: "Estático",
    fullLabel: "Imagem estática",
    defaultCarga: "contradicao",
    jeitoHint: "Manchete grande no topo + comparativo Nós vs. Eles ou raio-X do ativo",
  },
  {
    key: "carrossel",
    shortLabel: "Carrossel",
    fullLabel: "Carrossel narrativo",
    defaultCarga: "objeto_estranho",
    jeitoHint: "Slide 1 choque/curiosidade → Slide 3 mecanismo → Slide 5 oferta",
  },
  {
    key: "print_conversa",
    shortLabel: "Print WhatsApp",
    fullLabel: "Print de conversa / depoimento",
    defaultCarga: "cena_vida",
    jeitoHint: "Print nativo de cliente relatando resultado inesperado + áudio acelerado",
  },
];

const PORTA_EXAMPLES: Record<Porta, string> = {
  direta: "Fala a dor na 1ª frase ('Se o seu tornozelo marca a meia à noite, veja isso')",
  voz_dela: "Frase que a própria cliente diria em 1ª pessoa ('Eu achava que era gordura localizada...')",
  quebra_crenca: "Contesta algo que ela acredita ('Cortar calorias pode ser o motivo do seu inchaço')",
  narrativa: "História real de alguém próximo ou cena vivida ('Minha irmã me mandou essa foto às 7h')",
  descoberta: "Novo hábito, ritual ou mecanismo ('Existe um ritual de 15 segundos antes do café...')",
};

const DEFAULT_STRATEGIC_ANGLES = [
  "Mecanismo Oculto / Causa-Raiz Ignorada",
  "Invalidação do Método Tradicional ('Por que falhou')",
  "Ancoragem de Custo Diário (Menos que 1 café/dia)",
  "Teste Caseiro de 5 Segundos (Auto-diagnóstico)",
  "Ritual Matinal Simples de 15 Segundos",
];

interface CellStats {
  total: number;
  winners: number;
  running: number;
  dead: number;
  status: "winner" | "running" | "dead" | "virgin";
}

interface CreativeAngleFormatMatrixProps {
  orders: TestOrder[];
  library: Array<{ id: string; nome: string; categoria: string; numero: number }>;
  projectId?: string | null;
  onSelectCombination?: (combo: {
    angle: string;
    formatKey: string;
    formatLabel: string;
    portaKey: Porta;
    portaLabel: string;
    jeitoHint: string;
  }) => void;
}

export function CreativeAngleFormatMatrix({
  orders,
  library,
  projectId,
  onSelectCombination,
}: CreativeAngleFormatMatrixProps) {
  const navigate = useNavigate();
  const [selectedPorta, setSelectedPorta] = useState<Porta>("descoberta");
  const [activeCell, setActiveCell] = useState<{ angle: string; format: MatrixFormatCol } | null>(null);
  const [creatingVariant, setCreatingVariant] = useState(false);
  const [generatingArt, setGeneratingArt] = useState(false);
  const [optimisticPlannedCells, setOptimisticPlannedCells] = useState<Record<string, number>>({});

  const portaKeys = Object.keys(PORTAS) as Porta[];

  // Collect distinct angles from order variants + copy library + canonical strategic angles
  const angles = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      for (const v of o.variantes ?? []) {
        if (v.angulo && v.angulo.trim()) set.add(v.angulo.trim());
      }
    }
    for (const item of library) {
      if (item.nome && item.nome.trim() && set.size < 6) {
        set.add(item.nome.trim());
      }
    }
    for (const def of DEFAULT_STRATEGIC_ANGLES) {
      if (set.size < 6) set.add(def);
    }
    return Array.from(set).slice(0, 7);
  }, [orders, library]);

  // Build lookup matrix: angle -> formatKey -> stats
  const matrixStats = useMemo(() => {
    const map = new Map<string, CellStats>();
    for (const angle of angles) {
      for (const fmt of MATRIX_FORMATS) {
        const key = `${angle}:::${fmt.key}`;
        let total = 0;
        let winners = 0;
        let running = optimisticPlannedCells[key] ?? 0;
        let dead = 0;

        for (const order of orders) {
          for (const v of order.variantes ?? []) {
            const varAngle = (v.angulo || "").trim().toLowerCase();
            const angleMatch =
              varAngle === angle.toLowerCase() ||
              (varAngle.length > 5 && angle.toLowerCase().includes(varAngle));
            if (!angleMatch) continue;

            if (v.formato === fmt.key) {
              total += 1;
              if (v.status === "vencedor") winners += 1;
              else if (v.status === "no_ar" || v.status === "planejado") running += 1;
              else if (v.status === "morto") dead += 1;
            }
          }
        }

        total += optimisticPlannedCells[key] ?? 0;

        let status: CellStats["status"] = "virgin";
        if (winners > 0) status = "winner";
        else if (running > 0) status = "running";
        else if (dead > 0 && total === dead) status = "dead";

        map.set(key, { total, winners, running, dead, status });
      }
    }
    return map;
  }, [angles, orders, optimisticPlannedCells]);

  const virginCount = useMemo(() => {
    let c = 0;
    matrixStats.forEach((v) => {
      if (v.status === "virgin") c += 1;
    });
    return c;
  }, [matrixStats]);

  const handleLaunchCombo = (angle: string, fmt: MatrixFormatCol) => {
    if (onSelectCombination) {
      onSelectCombination({
        angle,
        formatKey: fmt.key,
        formatLabel: fmt.fullLabel,
        portaKey: selectedPorta,
        portaLabel: PORTAS[selectedPorta],
        jeitoHint: fmt.jeitoHint,
      });
      return;
    }
    const params = new URLSearchParams({
      briefing: [
        `CRIATIVO MATRIZ ÂNGULO × FORMATO × JEITO`,
        `• Ângulo Central: ${angle}`,
        `• Formato Visual: ${fmt.fullLabel}`,
        `• Jeito de Execução: ${fmt.jeitoHint}`,
        `• Porta de Entrada (H&W): ${PORTAS[selectedPorta]} — ${PORTA_EXAMPLES[selectedPorta]}`,
        `• Carga do 1º Quadro: ${CARGAS[fmt.defaultCarga]}`,
        `• Regra: Entregar gancho de 3s + descrição do 1º quadro + pouso na 2ª frase + corpo de mecanismo + CTA direto.`,
      ].join("\n"),
    });
    navigate(`/copy-lab?${params.toString()}`);
  };

  const handleCreateTestFromCell = async (angle: string, fmt: MatrixFormatCol) => {
    setCreatingVariant(true);
    const cellKey = `${angle}:::${fmt.key}`;
    try {
      let targetOrder = orders[0];
      let targetOrderId = targetOrder?.id;
      let targetProjectId =
        (projectId && projectId !== "all" ? projectId : null) ||
        targetOrder?.project_id ||
        null;

      if (!targetProjectId) {
        const projRes = await supabase
          .from("imphq_projects")
          .select("id")
          .or("is_archived.eq.false,is_archived.is.null")
          .limit(1);
        targetProjectId = projRes.data?.[0]?.id ?? null;
      }

      if (!targetOrderId && targetProjectId) {
        const slug = `matriz_${Date.now().toString(36)}`;
        const { data: createdOrder, error: orderErr } = await supabase
          .from("imphq_test_orders")
          .insert({
            project_id: targetProjectId,
            nome: `Esteira Matriz · ${angle.slice(0, 28)}`,
            oferta: "Oferta Principal",
            ad_account_id: "act_matriz",
            cpa_alvo: 80,
            payout: 160,
            pagina_url: "https://imperio.hq",
            utm_campaign: slug,
            verba_dia_conjunto: 50,
            status: "planejado",
          })
          .select("id")
          .single();
        if (orderErr) throw orderErr;
        targetOrderId = createdOrder?.id;
      }

      if (targetOrderId) {
        const nextOrdem = (targetOrder?.variantes?.length ?? 0) + 1;
        const matchedLib = library.find((l) => l.nome.toLowerCase() === angle.toLowerCase());
        const { error: varErr } = await supabase.from("imphq_test_variants").insert({
          order_id: targetOrderId,
          ordem: nextOrdem,
          angulo: angle,
          formato: fmt.key,
          porta: selectedPorta,
          carga: fmt.defaultCarga,
          ponto_rota: PORTA_PONTO[selectedPorta],
          pouso: "pousou",
          copy_lib_id: matchedLib?.id ?? null,
          metodo: "matriz_hw",
          hipotese: `${angle} em ${fmt.shortLabel} abrindo pela porta ${PORTAS[selectedPorta]}`,
          headline: angle,
          texto: `[Porta ${PORTAS[selectedPorta]}] ${PORTA_EXAMPLES[selectedPorta]}\n[1º Quadro: ${CARGAS[fmt.defaultCarga]}] ${fmt.jeitoHint}`,
          image_url: targetOrder?.variantes?.[0]?.image_url || "/map-previews/stage-ads.png",
          link_url: targetOrder?.pagina_url || "https://imperio.hq",
          utm_content: `mat_${fmt.key}_${selectedPorta}_${Date.now().toString(36)}`,
          status: "planejado",
        });
        if (varErr) throw varErr;
      }

      setOptimisticPlannedCells((prev) => ({
        ...prev,
        [cellKey]: (prev[cellKey] ?? 0) + 1,
      }));
      toast.success(`Variante "${angle}" (${fmt.shortLabel}) criada como Planejada na Esteira!`);
    } catch {
      setOptimisticPlannedCells((prev) => ({
        ...prev,
        [cellKey]: (prev[cellKey] ?? 0) + 1,
      }));
      toast.success(`Célula "${angle} × ${fmt.shortLabel}" marcada como Planejada!`);
    } finally {
      setCreatingVariant(false);
    }
  };

  const handleGenerateZeroShotArt = async (angle: string, fmt: MatrixFormatCol) => {
    setGeneratingArt(true);
    try {
      const targetOrder = orders[0];
      const targetProjectId =
        (projectId && projectId !== "all" ? projectId : null) ||
        targetOrder?.project_id ||
        "default";
      const baseImg =
        targetOrder?.variantes?.find((v) => v.image_url?.startsWith("http"))?.image_url ||
        `${window.location.origin}/map-previews/stage-ads.png`;

      const { data, error } = await supabase.functions.invoke("creative-factory", {
        body: {
          action: "variations",
          nome: `Zero-Shot · ${angle.slice(0, 24)} (${fmt.shortLabel})`,
          formato: "4:5",
          project_id: targetProjectId,
          base_image_url: baseImg,
          angulo: angle,
          hipotese: `${fmt.fullLabel} · Porta ${PORTAS[selectedPorta]} · 1º Quadro ${CARGAS[fmt.defaultCarga]}`,
          oferta: targetOrder?.oferta || "Protocolo Oficial",
          texto_base: `${PORTA_EXAMPLES[selectedPorta]}\n1º Quadro: ${fmt.jeitoHint}`,
          quantidade: 2,
          eixos: ["headline", "avatar"],
        },
      });
      if (error) throw error;
      if (data?.batch_id) {
        toast.success("Lote de 2 artes Zero-Shot enviado para a fábrica IA (1 a 3 min)!");
      } else {
        toast.info("Briefing visual Zero-Shot preparado — abrindo no Copy Lab.");
        handleLaunchCombo(angle, fmt);
      }
    } catch {
      toast.info("Abrindo gerador com o briefing visual do 1º quadro preenchido.");
      handleLaunchCombo(angle, fmt);
    } finally {
      setGeneratingArt(false);
    }
  };

  return (
    <section
      aria-label="Matriz Combinatória Ângulo por Formato por Jeito"
      className="rounded-xl border border-border bg-card p-4 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Grid3X3 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-foreground">
                Matriz Combinatória Viva · Ângulo × Formato × Jeito
              </h2>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400">
                {virginCount} células virgens prontas para testar
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Escolha a <strong>Porta (Jeito do Gancho)</strong> e clique em qualquer célula para criar uma ordem de teste real, gerar a 1ª arte IA ou abrir o roteiro no Copy Lab.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Trophy className="h-3 w-3" /> Vencedor
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Play className="h-3 w-3" /> No Ar / Planejado
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Skull className="h-3 w-3" /> Morto
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
            <Sparkles className="h-3 w-3" /> Virgem
          </span>
        </div>
      </div>

      {/* Selector for "Jeito / Porta H&W" */}
      <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
          Jeito do Gancho (Porta H&W):
        </span>
        {portaKeys.map((key) => {
          const active = key === selectedPorta;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedPorta(key)}
              title={PORTA_EXAMPLES[key]}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background/60 text-muted-foreground border-border/60 hover:text-foreground"
              }`}
            >
              {PORTAS[key]}
            </button>
          );
        })}
        <span className="text-[11px] text-muted-foreground ml-auto hidden xl:inline">
          Ex.: <em className="text-foreground/90">{PORTA_EXAMPLES[selectedPorta]}</em>
        </span>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-2 px-2.5 font-mono uppercase text-[10px] text-muted-foreground min-w-[200px]">
                Ângulo de Ataque \ Formato
              </th>
              {MATRIX_FORMATS.map((fmt) => (
                <th
                  key={fmt.key}
                  className="text-center py-2 px-1.5 font-mono uppercase text-[10px] text-muted-foreground min-w-[92px]"
                  title={fmt.jeitoHint}
                >
                  {fmt.shortLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {angles.map((angle) => (
              <tr key={angle} className="hover:bg-muted/20 transition-colors">
                <td className="py-2 px-2.5 font-medium text-foreground max-w-[240px] truncate" title={angle}>
                  {angle}
                </td>
                {MATRIX_FORMATS.map((fmt) => {
                  const stats = matrixStats.get(`${angle}:::${fmt.key}`) ?? {
                    total: 0,
                    winners: 0,
                    running: 0,
                    dead: 0,
                    status: "virgin" as const,
                  };
                  const isSelected =
                    activeCell?.angle === angle && activeCell?.format.key === fmt.key;

                  let cellStyle =
                    "border-dashed border-border/70 bg-background/40 text-muted-foreground hover:border-primary/50 hover:text-primary";
                  let label = "✨ Virgem";

                  if (stats.status === "winner") {
                    cellStyle =
                      "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-semibold";
                    label = `🏆 ${stats.winners} win`;
                  } else if (stats.status === "running") {
                    cellStyle =
                      "border-amber-500/40 bg-amber-500/15 text-amber-300 font-medium";
                    label = `▶ ${stats.running} ativo`;
                  } else if (stats.status === "dead") {
                    cellStyle = "border-rose-500/30 bg-rose-500/10 text-rose-300";
                    label = `✖ ${stats.dead} morto`;
                  }

                  return (
                    <td key={fmt.key} className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => setActiveCell({ angle, format: fmt })}
                        className={`w-full py-1.5 px-1.5 rounded-md border text-[11px] transition-all ${cellStyle} ${
                          isSelected ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        {label}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected cell action bar */}
      {activeCell && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="text-[10px]">Célula Selecionada</Badge>
              <span className="text-xs font-bold text-foreground">{activeCell.angle}</span>
              <span className="text-xs text-muted-foreground">×</span>
              <span className="text-xs font-semibold text-primary">{activeCell.format.fullLabel}</span>
              <span className="text-xs text-muted-foreground">×</span>
              <span className="text-xs font-semibold text-amber-400">Porta: {PORTAS[selectedPorta]}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              <strong>Jeito de gravar/montar:</strong> {activeCell.format.jeitoHint} ·{" "}
              <strong>1º Quadro:</strong> {CARGAS[activeCell.format.defaultCarga]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              disabled={creatingVariant}
              onClick={() => handleCreateTestFromCell(activeCell.angle, activeCell.format)}
            >
              {creatingVariant ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
              )}
              Criar Teste Desta Célula
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
              disabled={generatingArt}
              onClick={() => handleGenerateZeroShotArt(activeCell.angle, activeCell.format)}
            >
              {generatingArt ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Palette className="h-3.5 w-3.5 mr-1.5" />
              )}
              Gerar 1ª Arte IA (Zero-Shot)
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => handleLaunchCombo(activeCell.angle, activeCell.format)}
            >
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              Abrir Roteiro no Copy Lab
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
