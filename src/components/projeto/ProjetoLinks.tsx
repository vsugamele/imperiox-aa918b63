import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ExternalLink, Link } from "lucide-react";

interface LinkItem { label: string; url: string; }

interface Props {
  project: any;
  onUpdateData: (data: any) => void;
}

export function ProjetoLinks({ project, onUpdateData }: Props) {
  const data = project.data || {};
  const links: LinkItem[] = data.links || [];
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const addLink = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    const updated = [...links, { label: newLabel.trim(), url: newUrl.trim() }];
    onUpdateData({ ...data, links: updated });
    setNewLabel("");
    setNewUrl("");
  };

  const removeLink = (idx: number) => {
    const updated = links.filter((_, i) => i !== idx);
    onUpdateData({ ...data, links: updated });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔗 Links do Projeto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {links.map((link, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 border border-border">
            <Link className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-sm font-medium flex-1 truncate">{link.label}</span>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">
              {link.url}
            </a>
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
            </a>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeLink(i)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {links.length === 0 && <p className="text-sm text-muted-foreground">Nenhum link adicionado.</p>}
        <div className="flex gap-2 items-end pt-2 border-t border-border">
          <div className="flex-1">
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nome do link" className="bg-secondary h-8 text-xs" onKeyDown={e => e.key === "Enter" && addLink()} />
          </div>
          <div className="flex-1">
            <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." className="bg-secondary h-8 text-xs" onKeyDown={e => e.key === "Enter" && addLink()} />
          </div>
          <Button size="sm" variant="outline" onClick={addLink} className="h-8"><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
