import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileCode, Image } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FlowNode {
  id: string;
  title: string;
  subtitle?: string;
  type: "etapa" | "decisao" | "resultado" | "nota" | "imagem";
  color: string;
  pos_x: number;
  pos_y: number;
  image_url?: string;
  connects_to?: string[];
}

interface Props {
  onImportNodes: (nodes: FlowNode[]) => void;
  projectSlug?: string;
}

const NODE_W = 220;
const NODE_H = 100;

export function FlowImportDialog({ onImportNodes, projectSlug }: Props) {
  const [open, setOpen] = useState(false);
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const parseHTML = (html: string): FlowNode[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const sections = doc.querySelectorAll("section, div, article");
    const nodes: FlowNode[] = [];
    const cols = 4;

    const elements = sections.length > 0 ? sections : doc.body.children;

    Array.from(elements).forEach((el, i) => {
      const heading = el.querySelector("h1, h2, h3, h4, h5, h6");
      const para = el.querySelector("p");
      const title = heading?.textContent?.trim() || el.tagName || `Bloco ${i + 1}`;
      const subtitle = para?.textContent?.trim() || "";

      if (!title && !subtitle) return;

      nodes.push({
        id: crypto.randomUUID(),
        title: title.slice(0, 60),
        subtitle: subtitle.slice(0, 120),
        type: "etapa",
        color: "#3b82f6",
        pos_x: (i % cols) * (NODE_W + 40) + 60,
        pos_y: Math.floor(i / cols) * (NODE_H + 40) + 60,
      });
    });

    return nodes;
  };

  const handleHTMLUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const html = ev.target?.result as string;
      const nodes = parseHTML(html);
      if (nodes.length === 0) {
        toast.error("Nenhum elemento encontrado no HTML");
        return;
      }
      onImportNodes(nodes);
      toast.success(`${nodes.length} nós importados do HTML`);
      setOpen(false);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop() || "png";
    const path = `flowchart-images/${projectSlug || "general"}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("project-media").upload(path, file);
    if (error) {
      toast.error("Erro ao fazer upload da imagem");
      return;
    }

    const { data: urlData } = supabase.storage.from("project-media").getPublicUrl(path);

    const node: FlowNode = {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.[^.]+$/, ""),
      type: "imagem",
      color: "#64748b",
      pos_x: 200 + Math.random() * 100,
      pos_y: 200 + Math.random() * 100,
      image_url: urlData.publicUrl,
    };

    onImportNodes([node]);
    toast.success("Imagem adicionada ao fluxograma");
    setOpen(false);
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Upload className="h-3 w-3" /> Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar para o Fluxograma</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="html">
          <TabsList className="w-full">
            <TabsTrigger value="html" className="flex-1 gap-1"><FileCode className="h-3 w-3" /> HTML</TabsTrigger>
            <TabsTrigger value="image" className="flex-1 gap-1"><Image className="h-3 w-3" /> Imagem</TabsTrigger>
          </TabsList>
          <TabsContent value="html" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Faça upload de um arquivo .html e ele será convertido em nós do fluxograma automaticamente.
              Cada seção/div vira um nó, headers viram títulos.
            </p>
            <input ref={htmlInputRef} type="file" accept=".html,.htm" className="hidden" onChange={handleHTMLUpload} />
            <Button onClick={() => htmlInputRef.current?.click()} className="w-full gap-1">
              <FileCode className="h-4 w-4" /> Selecionar Arquivo HTML
            </Button>
          </TabsContent>
          <TabsContent value="image" className="space-y-3 pt-3">
            <p className="text-xs text-muted-foreground">
              Faça upload de uma imagem (PNG, JPG) para adicioná-la como um nó visual no fluxograma.
            </p>
            <input ref={imgInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImageUpload} />
            <Button onClick={() => imgInputRef.current?.click()} className="w-full gap-1">
              <Image className="h-4 w-4" /> Selecionar Imagem
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
