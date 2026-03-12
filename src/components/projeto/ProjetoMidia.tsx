import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Image } from "lucide-react";
import { FileUpload } from "@/components/FileUpload";

const CATEGORIES = [
  { key: "expert", label: "📸 Fotos do Expert" },
  { key: "produtos", label: "📦 Fotos dos Produtos" },
  { key: "complementar", label: "🖼️ Imagens Complementares" },
];

interface Props {
  project: any;
  onUpdateData: (data: any) => void;
}

export function ProjetoMidia({ project, onUpdateData }: Props) {
  const data = project.data || {};
  const midia = data.midia || {};
  const [newUrl, setNewUrl] = useState<Record<string, string>>({});

  const addImage = (cat: string, url?: string) => {
    const finalUrl = url || newUrl[cat]?.trim();
    if (!finalUrl) return;
    const current = midia[cat] || [];
    onUpdateData({ ...data, midia: { ...midia, [cat]: [...current, finalUrl] } });
    if (!url) setNewUrl({ ...newUrl, [cat]: "" });
  };

  const removeImage = (cat: string, i: number) => {
    const current = midia[cat] || [];
    onUpdateData({ ...data, midia: { ...midia, [cat]: current.filter((_: string, j: number) => j !== i) } });
  };

  return (
    <div className="space-y-6">
      {CATEGORIES.map((c) => (
        <Card key={c.key} className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">{c.label}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(midia[c.key] || []).map((url: string, i: number) => (
                <div key={i} className="relative group aspect-square rounded-md overflow-hidden border border-border bg-secondary">
                  <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removeImage(c.key, i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(midia[c.key] || []).length === 0 && (
                <div className="aspect-square rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground">
                  <Image className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <Input
                value={newUrl[c.key] || ""}
                onChange={(e) => setNewUrl({ ...newUrl, [c.key]: e.target.value })}
                placeholder="Cole a URL da imagem..."
                className="bg-secondary"
                onKeyDown={(e) => e.key === "Enter" && addImage(c.key)}
              />
              <Button size="sm" variant="outline" onClick={() => addImage(c.key)}><Plus className="h-3 w-3" /></Button>
              <FileUpload
                bucket="project-media"
                path={`${project.id}/${c.key}`}
                onUpload={(url) => addImage(c.key, url)}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
