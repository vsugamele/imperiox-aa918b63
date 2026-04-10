import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Trash2, Phone } from "lucide-react";
import { toast } from "sonner";

interface WaSession {
  id: string; phone: string; contact_name: string | null;
  session: string; project_id: string; status: string;
  message_count: number; metadata: any; created_at: string;
  provider_id: string | null;
}

interface Props {
  session: WaSession;
  projectName: string;
  providerLabel: string;
  onDelete: (id: string) => void;
}

export default function SessionDetailView({ session, projectName, providerLabel, onDelete }: Props) {
  const getWaLink = () => {
    const clean = session.phone.replace(/\D/g, "");
    const msg = (session.metadata as any)?.default_message;
    return `https://wa.me/${clean}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
  };

  const waLink = getWaLink();

  return (
    <Card className="bg-card border-border">
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{session.contact_name || session.phone}</h3>
            <p className="text-sm text-muted-foreground font-mono">{session.phone}</p>
          </div>
          <Badge variant="outline" className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            {session.status}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Projeto</span><span>{projectName}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sessão</span><span className="font-mono text-xs">{session.session}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Mensagens</span><span className="font-mono">{session.message_count}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Provider</span><span>{providerLabel}</span></div>
          {(session.metadata as any)?.default_message && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Mensagem padrão:</p>
              <p className="text-xs bg-secondary p-2 rounded">{(session.metadata as any).default_message}</p>
            </div>
          )}
        </div>

        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-2">Link direto:</p>
          <div className="p-2 bg-secondary rounded text-xs text-primary break-all font-mono">{waLink}</div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(waLink); toast.success("Link copiado!"); }}>
            <Copy className="h-3 w-3 mr-1" /> Copiar
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={waLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 mr-1" /> Abrir WA</a>
          </Button>
        </div>

        <Button size="sm" variant="destructive" onClick={() => onDelete(session.id)} className="w-full">
          <Trash2 className="h-3 w-3 mr-1" /> Excluir Sessão
        </Button>
      </CardContent>
    </Card>
  );
}
