import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Clapperboard, Sparkles, ListChecks, BookOpen } from "lucide-react";
import { StudioPrompts } from "@/components/studio/StudioPrompts";

export default function Studio() {
  const [tab, setTab] = useState("prompts");

  return (
    <div className="container mx-auto p-6 space-y-6">
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
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
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
