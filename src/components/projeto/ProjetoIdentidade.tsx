import type { Json, Tables } from "@/integrations/supabase/types";
import { jsonFields, jsonText, jsonNumber } from "@/lib/json-fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjetoBriefing } from "@/components/projeto/ProjetoBriefing";
import { ProjetoBranding } from "@/components/projeto/ProjetoBranding";
import { FileText, Palette, Eye } from "lucide-react";

interface Props {
  project: Tables<"imphq_projects">;
  onUpdateData: (data: Json) => void;
  onUpdatePipeline: (pipeline: Json) => void;
  onUpdateBrandKit: (brandKit: Json) => void;
}

const normHex = (c = "") => (c.startsWith("#") ? c : `#${c.replace(/^#+/, "")}`);

export function ProjetoIdentidade({ project, onUpdateData, onUpdatePipeline, onUpdateBrandKit }: Props) {
  const data = jsonFields(project.data);
  const bk = jsonFields(project.brand_kit);
  const produtos = Array.isArray(data.produtos) ? data.produtos.map(jsonFields) : [];
  const strings = (value: Json | undefined) => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  const cores = strings(bk.cores);
  const palavrasUsa = strings(bk.palavras_usa);
  const palavrasEvita = strings(bk.palavras_evita);

  return (
    <Tabs defaultValue="briefing" className="space-y-4">
      <TabsList className="bg-secondary">
        <TabsTrigger value="briefing" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Briefing</TabsTrigger>
        <TabsTrigger value="branding" className="gap-1.5"><Palette className="h-3.5 w-3.5" /> Branding</TabsTrigger>
        <TabsTrigger value="resumo" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Resumo Visual</TabsTrigger>
      </TabsList>

      <TabsContent value="briefing" className="mt-2">
        <ProjetoBriefing project={project} onUpdateData={onUpdateData} onUpdatePipeline={onUpdatePipeline} />
      </TabsContent>

      <TabsContent value="branding" className="mt-2">
        <ProjetoBranding project={project} onUpdateBrandKit={onUpdateBrandKit} />
      </TabsContent>

      <TabsContent value="resumo" className="mt-2 space-y-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
              <Eye className="h-4 w-4" /> Resumo da Marca em 1 Página
            </CardTitle>
            <p className="text-xs text-muted-foreground">Visão consolidada do que é a marca + o que vende</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Identidade */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Marca</p>
                <h2 className="text-2xl font-display font-bold">
                  <span className="text-3xl mr-2">{project.icon || "📁"}</span>
                  {project.name}
                </h2>
                {project.description && <p className="text-sm text-muted-foreground">{project.description}</p>}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {project.category && <Badge variant="secondary" className="text-[10px]">{project.category}</Badge>}
                  {jsonText(data.status) && <Badge variant="outline" className="text-[10px] capitalize">{jsonText(data.status)}</Badge>}
                  {jsonText(bk.arquetipo) && <Badge variant="outline" className="text-[10px] capitalize">🧬 {jsonText(bk.arquetipo)}</Badge>}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Paleta</p>
                {cores.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {cores.slice(0, 8).map((c, i) => (
                      <div key={i} className="h-9 w-9 rounded-md border border-border" style={{ backgroundColor: normHex(c) }} title={normHex(c)} />
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">Nenhuma cor cadastrada</p>
                )}
                {(jsonText(bk.fonte_titulo) || jsonText(bk.fonte_corpo)) && (
                  <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1">
                    {jsonText(bk.fonte_titulo) && <p>Título: <span className="text-foreground font-medium">{jsonText(bk.fonte_titulo)}</span></p>}
                    {jsonText(bk.fonte_corpo) && <p>Corpo: <span className="text-foreground font-medium">{jsonText(bk.fonte_corpo)}</span></p>}
                  </div>
                )}
              </div>
            </div>

            {/* Posicionamento curto */}
            {(jsonText(bk.inimigo_comum) || jsonText(bk.mecanismo_chave)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border">
                {jsonText(bk.inimigo_comum) && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Inimigo Comum</p>
                    <p className="text-xs leading-relaxed">{jsonText(bk.inimigo_comum)}</p>
                  </div>
                )}
                {jsonText(bk.mecanismo_chave) && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Mecanismo-Chave</p>
                    <p className="text-xs leading-relaxed">{jsonText(bk.mecanismo_chave)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Manifesto */}
            {jsonText(bk.manifesto) && (
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Manifesto</p>
                <p className="text-sm leading-relaxed italic text-foreground/90 border-l-2 border-primary/40 pl-3">{jsonText(bk.manifesto)}</p>
              </div>
            )}

            {/* Produtos resumo */}
            <div className="pt-2 border-t border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Produtos ({produtos.length})
              </p>
              {produtos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum produto cadastrado em Briefing.</p>
              ) : (
                <div className="space-y-1.5">
                  {produtos.map((p, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md bg-secondary/40 border border-border">
                      <span className="font-semibold flex-1 truncate">{jsonText(p.nome) || jsonText(p.name) || "—"}</span>
                      {jsonText(p.tipo) && <Badge variant="outline" className="text-[9px]">{jsonText(p.tipo)}</Badge>}
                      {(jsonNumber(p.preco) ?? jsonText(p.preco)) && <span className="font-mono text-primary text-[10px]">R$ {(jsonNumber(p.preco) ?? jsonText(p.preco))}</span>}
                      {jsonText(p.status) && <Badge variant="secondary" className="text-[9px] capitalize">{jsonText(p.status)}</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linguagem */}
            {((palavrasUsa?.length || 0) > 0 || (palavrasEvita?.length || 0) > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border">
                {palavrasUsa?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">✅ Usa</p>
                    <div className="flex flex-wrap gap-1">
                      {palavrasUsa.map((w: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300/90">{w}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {palavrasEvita?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-red-400 mb-1">🚫 Evita</p>
                    <div className="flex flex-wrap gap-1">
                      {palavrasEvita.map((w: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] border-red-500/30 text-red-300/90">{w}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
