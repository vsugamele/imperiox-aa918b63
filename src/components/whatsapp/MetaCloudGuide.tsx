import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const WEBHOOK_URL = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/whatsapp-api?provider=meta_cloud";

export default function MetaCloudGuide({ open, onOpenChange }: Props) {
  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} copiado`);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-secondary/40 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-primary">Conectar Meta Cloud API (oficial)</DialogTitle>
          <DialogDescription>WhatsApp Business nativo via Meta — sem provider intermediário.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-5 text-sm leading-7 mt-2">
          <li>
            <strong className="text-primary">1. Criar App na Meta</strong>
            <p className="text-muted-foreground">Acesse o painel de desenvolvedores da Meta, crie um app tipo <em>Business</em> e adicione o produto <em>WhatsApp</em>.</p>
            <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary text-xs mt-1 hover:underline"><ExternalLink className="h-3 w-3" /> developers.facebook.com/apps</a>
          </li>
          <li>
            <strong className="text-primary">2. Pegar Phone Number ID e WABA ID</strong>
            <p className="text-muted-foreground">Em <em>WhatsApp → API Setup</em>, copie o <code className="bg-muted px-1 rounded">Phone Number ID</code> e o <code className="bg-muted px-1 rounded">WhatsApp Business Account ID</code>.</p>
          </li>
          <li>
            <strong className="text-primary">3. Gerar Token permanente</strong>
            <p className="text-muted-foreground">No <em>Business Settings → System Users</em>, crie um System User com role <em>Admin</em>, atribua o app e gere um token com escopos <code className="bg-muted px-1 rounded">whatsapp_business_messaging</code> e <code className="bg-muted px-1 rounded">whatsapp_business_management</code>. Esse token <strong>não expira</strong>.</p>
          </li>
          <li>
            <strong className="text-primary">4. Colar credenciais aqui</strong>
            <p className="text-muted-foreground">Abra <em>Adicionar Provider → Meta Cloud API</em> e cole os 3 dados acima + invente um <code className="bg-muted px-1 rounded">webhook_verify_token</code> qualquer (ex: <code className="bg-muted px-1 rounded">imperius2026</code>).</p>
          </li>
          <li>
            <strong className="text-primary">5. Configurar Webhook na Meta</strong>
            <p className="text-muted-foreground">Em <em>WhatsApp → Configuration → Webhook</em>, clique em <em>Edit</em> e cole:</p>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 bg-muted/40 p-2 rounded">
                <span className="text-xs text-muted-foreground shrink-0">Callback URL:</span>
                <code className="text-xs flex-1 break-all">{WEBHOOK_URL}</code>
                <Button size="sm" variant="ghost" onClick={() => copy(WEBHOOK_URL, "URL")}><Copy className="h-3 w-3" /></Button>
              </div>
              <div className="flex items-center gap-2 bg-muted/40 p-2 rounded">
                <span className="text-xs text-muted-foreground shrink-0">Verify Token:</span>
                <code className="text-xs flex-1">o mesmo que você cadastrou no passo 4</code>
              </div>
            </div>
          </li>
          <li>
            <strong className="text-primary">6. Inscrever no campo "messages"</strong>
            <p className="text-muted-foreground">Após verificar, clique em <em>Manage</em> ao lado de <em>messages</em> e marque <code className="bg-muted px-1 rounded">messages</code>. Pronto — envio e recebimento ativos.</p>
          </li>
        </ol>
        <div className="mt-4 text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded p-3 leading-6">
          ⚠ Conta nova começa em <strong>sandbox</strong> (apenas números de teste). Para produção, finalize a <em>Business Verification</em> e adicione um número verificado no <em>Phone Numbers</em>.
        </div>
      </DialogContent>
    </Dialog>
  );
}
