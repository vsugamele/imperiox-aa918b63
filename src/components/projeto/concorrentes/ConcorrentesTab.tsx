import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { useConcorrentes } from "./useConcorrentes";
import { VisaoGeralTab } from "./VisaoGeralTab";
import { MercadoTab } from "./MercadoTab";
import { CopywritingTab } from "./CopywritingTab";
import { OfertaTab } from "./OfertaTab";
import { DossieTab } from "./DossieTab";
import { CompetitorImporter } from "./CompetitorImporter";

interface Props {
  projectId: string;
}

export function ConcorrentesTab({ projectId }: Props) {
  const { competitors, loading, addCompetitor, removeCompetitor, updateField, uploadScreenshot, importCompetitors } = useConcorrentes(projectId);
  const [showImporter, setShowImporter] = useState(false);

  if (loading) return <p className="text-muted-foreground p-4 text-sm">Carregando concorrentes...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Análise de Concorrentes ({competitors.length})</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowImporter(true)}>
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Button onClick={addCompetitor} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Concorrente
          </Button>
        </div>
      </div>

      <Tabs defaultValue="visao">
        <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="visao">📋 Visão Geral</TabsTrigger>
          <TabsTrigger value="mercado">📊 Mercado</TabsTrigger>
          <TabsTrigger value="copy">✍️ Copywriting</TabsTrigger>
          <TabsTrigger value="oferta">💰 Oferta</TabsTrigger>
          <TabsTrigger value="dossie">🔍 Dossiê</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="mt-4">
          <VisaoGeralTab competitors={competitors} updateField={updateField} />
        </TabsContent>
        <TabsContent value="mercado" className="mt-4">
          <MercadoTab competitors={competitors} updateField={updateField} />
        </TabsContent>
        <TabsContent value="copy" className="mt-4">
          <CopywritingTab competitors={competitors} updateField={updateField} />
        </TabsContent>
        <TabsContent value="oferta" className="mt-4">
          <OfertaTab competitors={competitors} updateField={updateField} />
        </TabsContent>
        <TabsContent value="dossie" className="mt-4">
          <DossieTab competitors={competitors} updateField={updateField} uploadScreenshot={uploadScreenshot} removeCompetitor={removeCompetitor} />
        </TabsContent>
      </Tabs>

      <CompetitorImporter
        open={showImporter}
        onClose={() => setShowImporter(false)}
        onImport={importCompetitors}
      />
    </div>
  );
}
