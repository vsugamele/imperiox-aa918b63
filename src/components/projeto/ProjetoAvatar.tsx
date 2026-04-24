import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Eye, CheckCircle, Package } from "lucide-react";
import { PerfilTab } from "./avatar/PerfilTab";
import { DesejosTab } from "./avatar/DesejosTab";
import { DoresTab } from "./avatar/DoresTab";
import { VoyerismosTab } from "./avatar/VoyerismosTab";
import { ProblemasTab } from "./avatar/ProblemasTab";
import { CopyArsenalTab } from "./avatar/CopyArsenalTab";
import { GatilhosTab } from "./avatar/GatilhosTab";
import { AvatarImporter } from "./avatar/AvatarImporter";
import { AvatarPipelineRunner } from "./avatar/AvatarPipelineRunner";

interface Props {
  project: any;
  onUpdateData: (data: any) => void;
  onUpdateAvatar: (avatar: any) => void;
}

const AVATAR_PRINCIPAL = "__principal__";

export function ProjetoAvatar({ project, onUpdateData, onUpdateAvatar }: Props) {
  const [showImporter, setShowImporter] = useState(false);
  const [showHtmlViewer, setShowHtmlViewer] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState(AVATAR_PRINCIPAL);

  const data = project.data || {};
  const produtos: any[] = data.produtos || [];
  const avatarsPorProduto: Record<string, any> = data.avatars_por_produto || {};

  // Resolve current avatar based on selection
  const avatar = useMemo(() => {
    if (selectedProduct === AVATAR_PRINCIPAL) return project.avatar || {};
    return avatarsPorProduto[selectedProduct] || {};
  }, [selectedProduct, project.avatar, avatarsPorProduto]);

  const handleUpdateAvatar = (newAvatar: any) => {
    if (selectedProduct === AVATAR_PRINCIPAL) {
      onUpdateAvatar(newAvatar);
    } else {
      const updated = { ...avatarsPorProduto, [selectedProduct]: newAvatar };
      onUpdateData({ ...data, avatars_por_produto: updated });
    }
  };

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
    handleUpdateAvatar(merged);
  };

  const productLabel = useMemo(() => {
    if (selectedProduct === AVATAR_PRINCIPAL) return "Avatar Principal";
    const prod = produtos.find((_: any, i: number) => String(i) === selectedProduct);
    return prod ? `Avatar — ${prod.nome || `Produto ${Number(selectedProduct) + 1}`}` : "Avatar";
  }, [selectedProduct, produtos]);

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
        <div className="flex items-center gap-2 flex-wrap">
          {project?.id && (
            <AvatarPipelineRunner projectId={project.id} avatar={avatar} onApply={handleUpdateAvatar} />
          )}
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

      {/* Product Avatar Selector */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
        <Package className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground shrink-0">Contexto:</span>
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-[280px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AVATAR_PRINCIPAL}>
              🧠 Avatar Principal (Projeto)
            </SelectItem>
            {produtos.map((p: any, i: number) => (
              <SelectItem key={i} value={String(i)}>
                📦 {p.nome || `Produto ${i + 1}`} {p.tipo ? `(${p.tipo})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedProduct !== AVATAR_PRINCIPAL && (
          <Badge variant="outline" className="text-xs">
            Ângulo específico do produto
          </Badge>
        )}
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
          <PerfilTab avatar={avatar} onUpdate={handleUpdateAvatar} projectId={project.id} />
        </TabsContent>
        <TabsContent value="desejos" className="mt-4">
          <DesejosTab avatar={avatar} onUpdate={handleUpdateAvatar} projectId={project.id} />
        </TabsContent>
        <TabsContent value="dores" className="mt-4">
          <DoresTab avatar={avatar} onUpdate={handleUpdateAvatar} projectId={project.id} />
        </TabsContent>
        <TabsContent value="voyerismos" className="mt-4">
          <VoyerismosTab avatar={avatar} onUpdate={handleUpdateAvatar} projectId={project.id} />
        </TabsContent>
        <TabsContent value="problemas" className="mt-4">
          <ProblemasTab avatar={avatar} onUpdate={handleUpdateAvatar} projectId={project.id} />
        </TabsContent>
        <TabsContent value="copy" className="mt-4">
          <CopyArsenalTab avatar={avatar} onUpdate={handleUpdateAvatar} />
        </TabsContent>
        <TabsContent value="gatilhos" className="mt-4">
          <GatilhosTab avatar={avatar} onUpdate={handleUpdateAvatar} projectId={project.id} />
        </TabsContent>
      </Tabs>

      <AvatarImporter open={showImporter} onClose={() => setShowImporter(false)} onImport={handleImport} projectId={project?.id} />

      {/* HTML Original Viewer */}
      <Dialog open={showHtmlViewer} onOpenChange={setShowHtmlViewer}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>HTML Original do Avatar — {productLabel}</DialogTitle>
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
