import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Eye, CheckCircle } from "lucide-react";
import { PerfilTab } from "./avatar/PerfilTab";
import { DesejosTab } from "./avatar/DesejosTab";
import { DoresTab } from "./avatar/DoresTab";
import { VoyerismosTab } from "./avatar/VoyerismosTab";
import { ProblemasTab } from "./avatar/ProblemasTab";
import { CopyArsenalTab } from "./avatar/CopyArsenalTab";
import { GatilhosTab } from "./avatar/GatilhosTab";
import { AvatarImporter } from "./avatar/AvatarImporter";

interface Props {
  project: any;
  onUpdateData: (data: any) => void;
  onUpdateAvatar: (avatar: any) => void;
}

export function ProjetoAvatar({ project, onUpdateData, onUpdateAvatar }: Props) {
  const [showImporter, setShowImporter] = useState(false);
  const [showHtmlViewer, setShowHtmlViewer] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const avatar = project.avatar || {};

  useEffect(() => {
    if (showHtmlViewer && avatar.html_original) {
      const blob = new Blob([avatar.html_original], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setBlobUrl(null);
    }
  }, [showHtmlViewer, avatar.html_original]);

  const hasHtmlOriginal = !!avatar.html_original;

  const handleImport = (imported: any) => {
    const merged = { ...avatar, ...imported };
    onUpdateAvatar(merged);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Sistema completo de inteligência de avatar — perfil, desejos, dores, problemas e arsenal de copy.</p>
          <Badge variant="secondary" className="gap-1 text-xs shrink-0">
            <CheckCircle className="h-3 w-3 text-green-500" />
            Auto-save
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {hasHtmlOriginal && (
            <Button variant="outline" size="sm" onClick={() => setShowHtmlViewer(true)}>
              <Eye className="h-3 w-3 mr-1" /> Ver HTML Original
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowImporter(true)}>
            <Upload className="h-3 w-3 mr-1" /> Importar HTML
          </Button>
        </div>
      </div>

      <Tabs defaultValue="perfil">
        <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="perfil">🧠 Perfil</TabsTrigger>
          <TabsTrigger value="desejos">💎 Desejos</TabsTrigger>
          <TabsTrigger value="dores">🩸 Dores</TabsTrigger>
          <TabsTrigger value="voyerismos">👁️ Voyerismos</TabsTrigger>
          <TabsTrigger value="problemas">🎯 Problemas</TabsTrigger>
          <TabsTrigger value="copy">✍️ Copy Arsenal</TabsTrigger>
          <TabsTrigger value="gatilhos">⚡ Gatilhos</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-4">
          <PerfilTab avatar={avatar} onUpdate={onUpdateAvatar} />
        </TabsContent>
        <TabsContent value="desejos" className="mt-4">
          <DesejosTab avatar={avatar} onUpdate={onUpdateAvatar} />
        </TabsContent>
        <TabsContent value="dores" className="mt-4">
          <DoresTab avatar={avatar} onUpdate={onUpdateAvatar} />
        </TabsContent>
        <TabsContent value="voyerismos" className="mt-4">
          <VoyerismosTab avatar={avatar} onUpdate={onUpdateAvatar} />
        </TabsContent>
        <TabsContent value="problemas" className="mt-4">
          <ProblemasTab avatar={avatar} onUpdate={onUpdateAvatar} />
        </TabsContent>
        <TabsContent value="copy" className="mt-4">
          <CopyArsenalTab avatar={avatar} onUpdate={onUpdateAvatar} />
        </TabsContent>
        <TabsContent value="gatilhos" className="mt-4">
          <GatilhosTab avatar={avatar} onUpdate={onUpdateAvatar} />
        </TabsContent>
      </Tabs>

      <AvatarImporter open={showImporter} onClose={() => setShowImporter(false)} onImport={handleImport} projectId={project?.id} />

      {/* HTML Original Viewer */}
      <Dialog open={showHtmlViewer} onOpenChange={setShowHtmlViewer}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>HTML Original do Avatar</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden rounded border border-border">
            <iframe
              src={blobUrl || ""}
              className="w-full h-[70vh] bg-white"
              title="HTML Original do Avatar"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
