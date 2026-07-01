import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Loader2, Layers, FolderInput, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  projectId: string;
  productName?: string;
  itemId: string;
  itemLabel: string;
  intent: string;
  output: string;
  promptHint: string;
  context: { avatar: string; branding: string; winners: string };
  onAppendOutput: (text: string) => void;
}

const FRAMEWORKS = [
  { key: "aida", label: "AIDA" },
  { key: "pas", label: "PAS" },
  { key: "4ps", label: "4Ps" },
  { key: "quest", label: "QUEST" },
  { key: "fab", label: "FAB" },
];

export function CreativeAdsActions({
  projectId, productName, itemId, itemLabel, intent, output, promptHint, context, onAppendOutput,
}: Props) {
  const [genImg, setGenImg] = useState(false);
  const [batchAb, setBatchAb] = useState(false);
  const [savedImg, setSavedImg] = useState<string | null>(null);

  const isCriativo = itemId === "criativos";
  const isCopy = itemId === "copy_anuncio" || itemId === "headlines" || itemId === "ganchos_impactantes";

  const handleGenerateImage = async () => {
    if (!output) return toast.error("Gere o briefing visual primeiro.");
    setGenImg(true);
    try {
      // Extract visual instruction from output (block "INSTRUÇÃO PARA IMAGEM" or full output)
      const m = output.match(/INSTRU[ÇC][ÃA]O.*?(?:IMAGEM|V[IÍ]DEO)[^\n]*\n+([\s\S]+?)(?:\n##+|\n---|\n###|$)/i);
      const visualPrompt = (m?.[1] || output).slice(0, 1800);
      const fullPrompt = `${visualPrompt}\n\n${context.branding ? `Branding: ${context.branding}` : ""}`.trim();

      const { data, error } = await supabase.functions.invoke("creative-image-gen", {
        body: {
          prompt: fullPrompt,
          project_id: projectId,
          title: `${itemLabel} — ${productName || "Criativo"}`,
          produto_nome: productName || null,
        },
      });
      if (error) throw error;
      const url = (data as any)?.file_url;
      if (!url) throw new Error("Sem URL retornada");
      setSavedImg(url);
      toast.success("Imagem gerada e salva em Referências");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar imagem");
    } finally {
      setGenImg(false);
    }
  };

  const handleBatchAB = async () => {
    setBatchAb(true);
    try {
      const productSummary = productName ? `PRODUTO: ${productName}` : "";
      const ctxBlock = [
        context.avatar && `### AVATAR\n${context.avatar}`,
        context.branding && `### BRANDING\n${context.branding}`,
      ].filter(Boolean).join("\n\n");

      const results: { fw: string; content: string }[] = [];
      for (const fw of FRAMEWORKS) {
        const input = `${promptHint}

Use estritamente o framework **${fw.label}** estrutura por estrutura.

${productSummary}

${ctxBlock}

Saída: 1 copy completa em markdown, 4-7 linhas, pt-BR, pronta pra Meta Ads. Use H3 (### ${fw.label}) no topo.`;
        try {
          const { data, error } = await supabase.functions.invoke("copy-engine", {
            body: { intent, input, context: { project_id: projectId } },
          });
          if (error) throw error;
          const content = (data as any)?.content || "";
          if (content) results.push({ fw: fw.label, content });
        } catch (e) {
          console.error("framework fail", fw.key, e);
        }
      }

      if (!results.length) throw new Error("Nenhuma variação gerada");
      const batch = `\n\n---\n\n## 🧪 BATERIA A/B (${results.length} frameworks)\n\n${results.map(r => r.content).join("\n\n---\n\n")}`;
      onAppendOutput(batch);
      toast.success(`${results.length} variações geradas`);
    } catch (e: any) {
      toast.error(e?.message || "Falha na bateria A/B");
    } finally {
      setBatchAb(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {isCriativo && (
          <Button
            size="sm" variant="outline"
            className="flex-1 h-8 text-xs border-fuchsia-700/50 text-fuchsia-300 hover:bg-fuchsia-900/30"
            onClick={handleGenerateImage} disabled={genImg || !output}
            title="Gera a imagem real a partir do briefing visual e salva em Referências"
          >
            {genImg ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ImageIcon className="h-3 w-3 mr-1" />}
            {genImg ? "Gerando imagem..." : "Gerar imagem agora"}
          </Button>
        )}
        {isCopy && (
          <Button
            size="sm" variant="outline"
            className="flex-1 h-8 text-xs border-amber-700/50 text-amber-300 hover:bg-amber-900/30"
            onClick={handleBatchAB} disabled={batchAb}
            title="Gera 5 variações com frameworks diferentes (AIDA/PAS/4Ps/QUEST/FAB)"
          >
            {batchAb ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Layers className="h-3 w-3 mr-1" />}
            {batchAb ? "Gerando bateria..." : "Bateria A/B (5 frameworks)"}
          </Button>
        )}
      </div>
      {savedImg && (
        <a
          href={savedImg} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-900/30"
        >
          <Check className="h-3.5 w-3.5" /> Imagem salva em Referências
          <FolderInput className="h-3 w-3 ml-auto opacity-60" />
        </a>
      )}
    </div>
  );
}
