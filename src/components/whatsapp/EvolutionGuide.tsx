import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const WEBHOOK_BASE = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/whatsapp-api";

export default function EvolutionGuide({ open, onOpenChange }: Props) {
  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} copiado`);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-secondary/40 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-primary">Conectar Evolution API</DialogTitle>
          <DialogDescription>WhatsApp não-oficial via QR Code — rápido de subir, ideal para testes e operações pequenas.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-5 text-sm leading-7 mt-2">
          <li>
            <strong className="text-primary">1. Ter uma Evolution API rodando</strong>
            <p className="text-muted-foreground">Você precisa de uma instância da Evolution API acessível por URL pública. Três caminhos:</p>
            <ul className="list-disc pl-5 text-muted-foreground text-xs mt-1 space-y-1">
              <li>SaaS pronto (mais fácil): EvolutionPro, ZapMaster, Codechat, etc.</li>
              <li>VPS própria com Docker (Hostinger, Contabo, DigitalOcean): <a href="https://doc.evolution-api.com/v2/install/docker" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">docs <ExternalLink className="h-3 w-3" /></a></li>
              <li>Easypanel / Coolify / Render</li>
            </ul>
          </li>
          <li>
            <strong className="text-primary">2. Pegar API URL + API Key global</strong>
            <p className="text-muted-foreground">No painel da sua Evolution, copie a URL (ex: <code className="bg-muted px-1 rounded">https://evo.seudominio.com</code>) e a <code className="bg-muted px-1 rounded">AUTHENTICATION_API_KEY</code> definida no <code className="bg-muted px-1 rounded">.env</code> do servidor.</p>
          </li>
          <li>
            <strong className="text-primary">3. Criar uma Instância</strong>
            <p className="text-muted-foreground">Crie uma instância na Evolution com um nome técnico curto e sem espaços (ex: <code className="bg-muted px-1 rounded">imperius-vendas</code>). Esse nome será usado em todos os webhooks.</p>
          </li>
          <li>
            <strong className="text-primary">4. Cadastrar aqui no Imperius</strong>
            <p className="text-muted-foreground">Abra <em>Adicionar Provider → Evolution API</em> e cole: URL, API Key e o <strong>mesmo nome técnico</strong> da instância.</p>
          </li>
          <li>
            <strong className="text-primary">5. Escanear QR Code</strong>
            <p className="text-muted-foreground">Após salvar, clique em <em>Conectar / QR Code</em> no card do chip e escaneie pelo WhatsApp do celular: <em>Aparelhos conectados → Conectar um aparelho</em>.</p>
          </li>
          <li>
            <strong className="text-primary">6. Configurar Webhook na instância</strong>
            <p className="text-muted-foreground">Na Evolution, em <em>Webhook</em> da instância, ative <code className="bg-muted px-1 rounded">Webhook by Events</code> e cole a URL abaixo. Marque pelo menos: <code className="bg-muted px-1 rounded">MESSAGES_UPSERT</code>, <code className="bg-muted px-1 rounded">CONNECTION_UPDATE</code>, <code className="bg-muted px-1 rounded">QRCODE_UPDATED</code>, <code className="bg-muted px-1 rounded">GROUP_PARTICIPANTS_UPDATE</code>.</p>
            <div className="mt-2 flex items-center gap-2 bg-muted/40 p-2 rounded">
              <span className="text-xs text-muted-foreground shrink-0">Webhook URL:</span>
              <code className="text-xs flex-1 break-all">{WEBHOOK_BASE}/&#123;NOME_DA_INSTANCIA&#125;</code>
              <Button size="sm" variant="ghost" onClick={() => copy(`${WEBHOOK_BASE}/SUA_INSTANCIA`, "URL")}><Copy className="h-3 w-3" /></Button>
            </div>
            <p className="text-[11px] text-amber-300/80 mt-1">Substitua <code className="bg-muted px-1 rounded">&#123;NOME_DA_INSTANCIA&#125;</code> pelo nome técnico que você criou no passo 3.</p>
          </li>
        </ol>
        <div className="mt-4 text-xs text-sky-300/90 bg-sky-500/10 border border-sky-500/30 rounded p-3 leading-6">
          💡 Use Evolution para volume baixo/médio e testes. Para escala, conformidade e templates oficiais, prefira <strong>Meta Cloud API</strong>.
        </div>
      </DialogContent>
    </Dialog>
  );
}
