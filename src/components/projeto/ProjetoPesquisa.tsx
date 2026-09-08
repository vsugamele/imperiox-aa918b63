import type { Json, Tables } from "@/integrations/supabase/types";
import { jsonFields, jsonText } from "@/lib/json-fields";
import { errorMessage } from "@/lib/error-message";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Loader2, UserCheck, FileText, Clock, ExternalLink } from "lucide-react";

type ExtractedData = {
  nome?: string;
  area?: string;
  bio?: string;
  tom_voz?: string;
  metodo?: string;
  temas?: string[];
  palavras_usa?: string[];
  transformacao?: string;
  raw_content?: string;
}

type ResearchEntry = {
  url: string;
  date: string;
  extracted: ExtractedData;
}

function parseExtracted(value: Json | undefined): ExtractedData {
  const fields = jsonFields(value);
  return {
    ...fields,
    nome: jsonText(fields.nome),
    area: jsonText(fields.area),
    bio: jsonText(fields.bio),
    tom_voz: jsonText(fields.tom_voz),
    metodo: jsonText(fields.metodo),
    transformacao: jsonText(fields.transformacao),
    raw_content: jsonText(fields.raw_content),
    temas: Array.isArray(fields.temas) ? fields.temas.filter((item): item is string => typeof item === "string") : undefined,
    palavras_usa: Array.isArray(fields.palavras_usa) ? fields.palavras_usa.filter((item): item is string => typeof item === "string") : undefined,
  };
}

interface Props {
  project: Tables<"imphq_projects">;
  onUpdateData: (data: Json) => void;
}

export function ProjetoPesquisa({ project, onUpdateData }: Props) {
  const data = jsonFields(project.data);
  const history: ResearchEntry[] = Array.isArray(data.research_history) ? data.research_history.flatMap(value => {
    const entry = jsonFields(value);
    return typeof entry.url === "string" && typeof entry.date === "string" ? [{ ...entry, url: entry.url, date: entry.date, extracted: parseExtracted(entry.extracted) }] : [];
  }) : [];
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractedData | null>(null);

  const handleResearch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const { data: resData, error } = await supabase.functions.invoke<Json>("expert-research", {
        body: { url: url.trim(), project_id: project.id },
      });

      if (error) throw error;
      const response = jsonFields(resData);
      if (!response.success) throw new Error(jsonText(response.error) || "Falha na pesquisa");

      const extracted = parseExtracted(response.extracted);
      extracted.raw_content = jsonText(response.raw_content);
      setResult(extracted);

      // Save to history
      const newHistory = [
        { url: url.trim(), date: new Date().toISOString(), extracted },
        ...history.slice(0, 9),
      ];
      onUpdateData({ ...data, research_history: newHistory });

      toast.success("Dados extraídos com sucesso!");
    } catch (err: unknown) {
      console.error("Research error:", err);
      toast.error(errorMessage(err) || "Erro ao pesquisar");
    } finally {
      setLoading(false);
    }
  };

  const applyToExpert = () => {
    if (!result) return;
    const expert = jsonFields(data.expert);
    const updated = {
      ...expert,
      ...(result.nome && { nome: result.nome }),
      ...(result.area && { area: result.area }),
      ...(result.bio && { bio: result.bio }),
      ...(result.tom_voz && { tom_voz: result.tom_voz }),
      ...(result.metodo && { metodo: result.metodo }),
      ...(result.temas && { temas: result.temas }),
      ...(result.palavras_usa && { palavras_usa: result.palavras_usa }),
      ...(result.transformacao && { transformacao: result.transformacao }),
    };
    onUpdateData({ ...data, expert: updated });
    toast.success("Dados aplicados ao Expert!");
  };

  const saveAsDoc = async () => {
    if (!result?.raw_content) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { error } = await supabase.from("imphq_kb").insert({
        id: crypto.randomUUID(),
        section_key: `research_${Date.now()}`,
        title: `Pesquisa: ${url}`,
        content: result.raw_content,
        is_custom: true,
      });
      if (error) throw error;
      toast.success("Salvo na Knowledge Base!");
    } catch (err) {
      toast.error("Erro ao salvar documento");
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔬 Pesquisa de Expert / Avatar</CardTitle>
          <p className="text-xs text-muted-foreground">Cole a URL do site, canal do YouTube ou perfil do expert para extrair dados automaticamente</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://site-do-expert.com.br"
              className="bg-secondary flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleResearch()}
            />
            <Button onClick={handleResearch} disabled={loading || !url.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              {loading ? "Pesquisando..." : "Pesquisar"}
            </Button>
          </div>
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">Sites</Badge>
            <Badge variant="outline" className="text-[10px]">YouTube</Badge>
            <Badge variant="outline" className="text-[10px]">Instagram</Badge>
            <Badge variant="outline" className="text-[10px]">Landing Pages</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className="bg-card border-border border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📋 Dados Extraídos</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={applyToExpert}>
                <UserCheck className="h-3 w-3 mr-1" /> Aplicar ao Expert
              </Button>
              <Button size="sm" variant="outline" onClick={saveAsDoc}>
                <FileText className="h-3 w-3 mr-1" /> Salvar como Doc
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.nome && (
                <div>
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <p className="text-sm font-medium">{result.nome}</p>
                </div>
              )}
              {result.area && (
                <div>
                  <Label className="text-xs text-muted-foreground">Área de Atuação</Label>
                  <p className="text-sm">{result.area}</p>
                </div>
              )}
              {result.bio && (
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Bio</Label>
                  <p className="text-sm text-muted-foreground">{result.bio}</p>
                </div>
              )}
              {result.tom_voz && (
                <div>
                  <Label className="text-xs text-muted-foreground">Tom de Voz</Label>
                  <p className="text-sm">{result.tom_voz}</p>
                </div>
              )}
              {result.metodo && (
                <div>
                  <Label className="text-xs text-muted-foreground">Método / Framework</Label>
                  <p className="text-sm">{result.metodo}</p>
                </div>
              )}
              {result.transformacao && (
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Transformação Prometida</Label>
                  <p className="text-sm">{result.transformacao}</p>
                </div>
              )}
              {result.temas && result.temas.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Temas</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.temas.map((t, i) => <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                </div>
              )}
              {result.palavras_usa && result.palavras_usa.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Palavras Frequentes</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.palavras_usa.map((w, i) => <Badge key={i} variant="outline" className="text-[10px]">{w}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🕐 Histórico de Pesquisas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {history.map((entry, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded bg-secondary/50 border border-border text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate text-xs">{entry.url}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{new Date(entry.date).toLocaleDateString("pt-BR")}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setResult(entry.extracted)}>
                    Ver
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
