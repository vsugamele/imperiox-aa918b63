import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function HubGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-lg bg-card">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors rounded-lg">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Guia Técnico — Hub Local</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4">
        <div className="space-y-5 text-xs text-muted-foreground leading-relaxed">

          {/* Arquitetura */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">📐 Arquitetura</h4>
            <p>O Hub Local usa um padrão <strong>command bus</strong> via Supabase. O front-end nunca fala diretamente com o worker — toda comunicação passa por 3 tabelas:</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">wa_hub_iso_commands</Badge>
                <span>Fila de comandos. Front insere, worker consome.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">wa_hub_iso_events</Badge>
                <span>Eventos do worker (ex: <code className="bg-muted px-1 rounded">qr_status</code>). Front faz polling aqui.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">wa_hub_iso_sessions</Badge>
                <span>Estado persistente da sessão (<code className="bg-muted px-1 rounded">connected</code>, <code className="bg-muted px-1 rounded">reset</code>, etc.).</span>
              </div>
            </div>
          </section>

          {/* Fluxo */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">🔄 Fluxo de Conexão (QR)</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Front insere comando <code className="bg-muted px-1 rounded">get_qr</code> em <code className="bg-muted px-1 rounded">wa_hub_iso_commands</code></li>
              <li>Worker local faz polling na tabela, pega o comando e muda status para <code className="bg-muted px-1 rounded">processing</code></li>
              <li>Worker gera o QR via whatsapp-web.js e grava um evento <code className="bg-muted px-1 rounded">qr_status</code> em <code className="bg-muted px-1 rounded">wa_hub_iso_events</code></li>
              <li>Front faz polling nos events e no command result. Quando encontra <code className="bg-muted px-1 rounded">qrImageUrl</code>, exibe a imagem</li>
              <li>Usuário escaneia → worker detecta conexão → atualiza <code className="bg-muted px-1 rounded">wa_hub_iso_sessions.status = 'connected'</code></li>
              <li>Front detecta <code className="bg-muted px-1 rounded">connected</code> no polling e para</li>
            </ol>
          </section>

          {/* Campos do Payload */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">📦 Campos esperados no payload</h4>
            <p>O front procura o QR nos seguintes campos (em ordem de prioridade):</p>
            <div className="mt-1 font-mono text-[10px] bg-muted p-2 rounded space-y-0.5">
              <p><strong>Evento qr_status:</strong> payload.qrImageUrl | payload.qr | payload.image</p>
              <p><strong>Command result:</strong> result.qr.qrImageUrl | result.qr.image | result.qrImageUrl</p>
              <p><strong>QR Text:</strong> payload.qrText | result.qr.qrText | result.qrText</p>
              <p><strong>Flags:</strong> needsQr, qrAvailable, hasSession, instructions</p>
            </div>
          </section>

          {/* Worker */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">⚙️ Como rodar o Worker</h4>
            <p>O worker é um servidor Node.js rodando localmente (ou em VPS) que:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Faz polling em <code className="bg-muted px-1 rounded">wa_hub_iso_commands</code> a cada 2-5s filtrando por <code className="bg-muted px-1 rounded">tenant_id</code> e <code className="bg-muted px-1 rounded">status = 'pending'</code></li>
              <li>Processa ações: <code className="bg-muted px-1 rounded">get_qr</code>, <code className="bg-muted px-1 rounded">send_message</code>, <code className="bg-muted px-1 rounded">reset_session</code></li>
              <li>Grava resultados em <code className="bg-muted px-1 rounded">wa_hub_iso_events</code> e/ou atualiza o <code className="bg-muted px-1 rounded">result</code> do command</li>
              <li>Endpoints esperados: <code className="bg-muted px-1 rounded">GET /projects/:id/session/status</code>, <code className="bg-muted px-1 rounded">GET /projects/:id/session/qr</code>, <code className="bg-muted px-1 rounded">POST /projects/:id/session/reset</code></li>
            </ul>
          </section>

          {/* Reset */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">🧹 Reset de Sessão</h4>
            <p>Quando uma sessão trava (status <code className="bg-muted px-1 rounded">stale</code> ou <code className="bg-muted px-1 rounded">error</code>):</p>
            <ol className="list-decimal list-inside space-y-1 mt-1">
              <li>Front insere comando <code className="bg-muted px-1 rounded">reset_session</code></li>
              <li>Worker encerra socket, limpa pasta <code className="bg-muted px-1 rounded">sessions/&lt;id&gt;</code></li>
              <li>Front deleta eventos e commands antigos do Supabase</li>
              <li>Sessão volta para <code className="bg-muted px-1 rounded">idle</code>, pronta para novo <code className="bg-muted px-1 rounded">get_qr</code></li>
            </ol>
            <p className="mt-1">Use o botão <strong>"Limpar Sessão"</strong> no painel QR, ou <strong>"Limpar Offline"</strong> para deletar sessões travadas em lote.</p>
          </section>

          {/* Troubleshooting */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">🐛 Troubleshooting</h4>
            <div className="space-y-2">
              <div>
                <p className="font-medium text-foreground">QR não aparece:</p>
                <ul className="list-disc list-inside ml-2">
                  <li>Worker pode estar offline — verifique se o processo está rodando</li>
                  <li>Campo de QR pode ser diferente — veja "Campos esperados" acima</li>
                  <li>Sessão pode estar presa — use "Limpar Sessão" e tente novamente</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Sessão "stale" / travada:</p>
                <ul className="list-disc list-inside ml-2">
                  <li>O command foi concluído mas nenhum QR chegou após 2 polls</li>
                  <li>Use "Limpar Sessão" → "Gerar QR" para forçar nova sessão</li>
                  <li>Se persistir, gere uma nova session key</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Worker respondeu mas status fica "pending":</p>
                <ul className="list-disc list-inside ml-2">
                  <li>O worker pode não estar atualizando o status do command para <code className="bg-muted px-1 rounded">done</code></li>
                  <li>Verifique os logs do worker para erros silenciosos</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
