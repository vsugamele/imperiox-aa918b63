import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const BASE_URL = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento";

const PLATFORMS = [
  {
    name: "Hotmart", icon: "🟧",
    steps: [
      "Acesse Ferramentas → Webhooks no painel da Hotmart",
      "Clique em 'Configurar Webhook'",
      "Cole a URL do webhook (com ?project=ID se quiser vincular)",
      "Selecione: PURCHASE_APPROVED, PURCHASE_REFUNDED, PURCHASE_CANCELED",
      "Salve e teste",
    ],
    fields: ["transaction", "product.name", "buyer.name", "buyer.email", "buyer.phone", "purchase.price.value"],
  },
  {
    name: "Kiwify", icon: "🟩",
    steps: [
      "Acesse Configurações → Webhooks no painel Kiwify",
      "Clique em 'Adicionar Webhook'",
      "Cole a URL do webhook",
      "Selecione: order_paid, order_refunded",
      "Salve a configuração",
    ],
    fields: ["order_id", "Customer.full_name", "Customer.email", "Customer.mobile", "Product.product_name", "order_status"],
  },
  {
    name: "Ticto", icon: "🟦",
    steps: [
      "Acesse Integrações → Webhooks no painel Ticto",
      "Adicione a URL do webhook",
      "Configure os eventos (venda aprovada, reembolso)",
      "Salve e teste",
    ],
    fields: ["transaction_id", "customer_name", "customer_email", "customer_phone", "product_name", "amount"],
  },
  {
    name: "Perfect Pay", icon: "🟨",
    steps: [
      "Acesse Ferramentas → Notificações (Postback) no painel Perfect Pay",
      "Adicione a URL do webhook (com ?project=ID)",
      "Selecione os status: Aprovado, Pendente, PIX gerado, Boleto, Reembolso, Chargeback",
      "Opcional: defina um Token e cole o mesmo em data.perfectpay_token do projeto",
      "Salve e dispare um teste",
    ],
    fields: ["code", "sale_status_enum", "payment_method_enum", "customer.email", "customer.full_name", "customer.phone_formated", "product.name", "sale_amount"],
  },
];

const FLOW_STEPS = [
  { label: "Plataforma", sub: "Hotmart / Kiwify / Ticto / Perfect Pay", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  { label: "Webhook", sub: "Edge Function", className: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  { label: "Processamento", sub: "Lead + Venda + CAPI", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { label: "Automações", sub: "Email / WA / Telegram", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
];

const PIPELINE_STEPS = [
  { icon: "📥", text: "Payload recebido e salvo em imphq_webhooks" },
  { icon: "🔍", text: "Sistema identifica a plataforma pelo formato" },
  { icon: "💰", text: "Compra aprovada → cria lead + registra venda" },
  { icon: "📊", text: "Facebook CAPI configurado → envia evento Purchase" },
  { icon: "⚡", text: "Automações vinculadas são disparadas" },
];

export function WebhookGuide({ projects }: { projects: { id: string; name: string }[] }) {
  const copyUrl = (url: string, label?: string) => {
    navigator.clipboard.writeText(url);
    toast.success(label ? `URL de ${label} copiada!` : "Copiado!");
  };

  return (
    <div className="space-y-6">
      {/* Flow diagram */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm text-primary">Fluxo de Dados</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 flex-wrap py-4">
            {FLOW_STEPS.map((item, i) => (
              <div key={i} className="contents">
                {i > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div className={`px-4 py-3 rounded-lg border text-center min-w-[130px] ${item.className}`}>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[10px] opacity-70">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* URLs per project */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm text-primary">URLs por Projeto</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="text-xs bg-secondary px-3 py-2 rounded flex-1 font-mono truncate">{BASE_URL}</code>
            <Button size="sm" variant="outline" onClick={() => copyUrl(BASE_URL)}><Copy className="h-3 w-3" /></Button>
          </div>
          {projects.map(p => {
            const url = `${BASE_URL}?project=${p.id}`;
            return (
              <div key={p.id} className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] shrink-0">{p.name}</Badge>
                <code className="text-[10px] bg-secondary px-2 py-1.5 rounded flex-1 font-mono truncate">{url}</code>
                <Button size="sm" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyUrl(url, p.name)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Platform guides */}
      {PLATFORMS.map(p => (
        <Card key={p.name} className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2">{p.icon} {p.name}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ol className="space-y-1.5">
              {p.steps.map((step, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">{i + 1}</Badge>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-1">
              {p.fields.map(f => <Badge key={f} variant="secondary" className="text-[9px] font-mono">{f}</Badge>)}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Pipeline explanation */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm text-primary">O que acontece quando o webhook chega?</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {PIPELINE_STEPS.map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-2 rounded bg-secondary/50 border border-border">
              <span className="text-base shrink-0">{item.icon}</span>
              <p className="text-xs">{item.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
