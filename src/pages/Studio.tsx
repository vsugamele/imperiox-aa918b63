import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clapperboard, Sparkles, ListChecks, BookOpen, Wand2, Workflow, Zap, Vault, Film, UserSquare2, ScrollText, Layers } from "lucide-react";
import { ModelagemTab } from "@/components/studio/ModelagemTab";
import { StudioPrompts } from "@/components/studio/StudioPrompts";
import { StudioGenerator } from "@/components/studio/StudioGenerator";
import { StudioWorkflow } from "@/components/studio/StudioWorkflow";
import { HyperPromptGenerator } from "@/components/studio/HyperPromptGenerator";
import { HyperPromptVault } from "@/components/studio/HyperPromptVault";
import { VideoPromptGenerator } from "@/components/studio/VideoPromptGenerator";
import { AvatarStudioTab } from "@/components/studio/AvatarStudioTab";
import { RoteirosTab } from "@/components/studio/RoteirosTab";
import type { HyperFields } from "@/lib/hyperPromptBuilder";
import { ProdutoTabs } from "@/components/produto/ProdutoTabs";

export default function Studio() {
  const [tab, setTab] = useState("generator");
  const [vaultRefresh, setVaultRefresh] = useState(0);
  const [loadedFields, setLoadedFields] = useState<HyperFields | null>(null);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <ProdutoTabs />
      <div className="flex items-center gap-3">
        <Clapperboard className="h-7 w-7 text-primary" />
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">Studio</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline de vídeo, plano de avatar e biblioteca de prompts ultrarrealistas.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-6xl grid-cols-11">
          <TabsTrigger value="generator" className="gap-2">
            <Wand2 className="h-4 w-4" /> Gerar
          </TabsTrigger>
          <TabsTrigger value="modelagem" className="gap-2">
            <Layers className="h-4 w-4" /> Modelagem
          </TabsTrigger>
          <TabsTrigger value="roteiros" className="gap-2">
            <ScrollText className="h-4 w-4" /> Roteiros
          </TabsTrigger>
          <TabsTrigger value="avatar-studio" className="gap-2">
            <UserSquare2 className="h-4 w-4" /> Avatar Studio
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-2">
            <Film className="h-4 w-4" /> Vídeo
          </TabsTrigger>
          <TabsTrigger value="hyper" className="gap-2">
            <Zap className="h-4 w-4" /> Hyper
          </TabsTrigger>
          <TabsTrigger value="cofre" className="gap-2">
            <Vault className="h-4 w-4" /> Cofre
          </TabsTrigger>
          <TabsTrigger value="workflow" className="gap-2">
            <Workflow className="h-4 w-4" /> Workflow
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-2">
            <Sparkles className="h-4 w-4" /> Prompts
          </TabsTrigger>
          <TabsTrigger value="avatar" className="gap-2">
            <ListChecks className="h-4 w-4" /> Avatar Plan
          </TabsTrigger>
          <TabsTrigger value="playbook" className="gap-2">
            <BookOpen className="h-4 w-4" /> Playbook
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roteiros" className="mt-6">
          <RoteirosTab />
        </TabsContent>

        <TabsContent value="modelagem" className="mt-6">
          <ModelagemTab />
        </TabsContent>



        <TabsContent value="avatar-studio" className="mt-6">
          <AvatarStudioTab />
        </TabsContent>

        <TabsContent value="generator" className="mt-6">
          <StudioGenerator />
        </TabsContent>

        <TabsContent value="video" className="mt-6">
          <VideoPromptGenerator />
        </TabsContent>

        <TabsContent value="hyper" className="mt-6">
          <HyperPromptGenerator
            externalFields={loadedFields}
            onSaved={() => setVaultRefresh((v) => v + 1)}
          />
        </TabsContent>

        <TabsContent value="cofre" className="mt-6">
          <HyperPromptVault
            refreshKey={vaultRefresh}
            onLoad={(f) => {
              setLoadedFields(f);
              setTab("hyper");
            }}
          />
        </TabsContent>

        <TabsContent value="workflow" className="mt-6">
          <StudioWorkflow />
        </TabsContent>

        <TabsContent value="prompts" className="mt-6">
          <StudioPrompts />
        </TabsContent>

        <TabsContent value="avatar" className="mt-6">
          <div className="rounded-lg border border-border overflow-hidden bg-secondary/20">
            <iframe
              src="/studio/avatar-plan.html"
              title="Avatar Plan"
              className="w-full"
              style={{ height: "calc(100vh - 220px)", minHeight: 700 }}
            />
          </div>
        </TabsContent>

        <TabsContent value="playbook" className="mt-6">
          <div className="rounded-lg border border-border overflow-hidden bg-secondary/20">
            <iframe
              src="/studio/playbook.html"
              title="Video Pipeline Playbook"
              className="w-full"
              style={{ height: "calc(100vh - 220px)", minHeight: 700 }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
