import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
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
  const avatar = project.avatar || {};

  const handleImport = (imported: any) => {
    // Merge imported data with existing avatar
    const merged = { ...avatar, ...imported };
    onUpdateAvatar(merged);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Sistema completo de inteligência de avatar — perfil, desejos, dores, problemas e arsenal de copy.</p>
        <Button variant="outline" size="sm" onClick={() => setShowImporter(true)}>
          <Upload className="h-3 w-3 mr-1" /> Importar HTML
        </Button>
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

      <AvatarImporter open={showImporter} onClose={() => setShowImporter(false)} onImport={handleImport} />
    </div>
  );
}
