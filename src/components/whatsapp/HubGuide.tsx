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

          {/* Máquina de estados */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">🎯 Máquina de Estados (UiStatus)</h4>
            <p>O front usa 8 estados com <strong>prioridade: QR {">"} connected</strong>. Se existir QR, mostra QR — mesmo que <code className="bg-muted px-1 rounded">hasSession=true</code>.</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 bg-muted">idle</Badge>
                <span>Sem sessão ativa. Pronto para gerar QR.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 bg-amber-500/15 text-amber-400">resetting</Badge>
                <span>Limpando sessão anterior (apagando events/commands).</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 bg-amber-500/15 text-amber-400">pending</Badge>
                <span>Comando <code className="bg-muted px-1 rounded">get_qr</code> enviado, aguardando worker.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 bg-blue-500/15 text-blue-400">awaiting_qr</Badge>
                <span>Worker respondeu, QR sinalizado mas imagem ainda não chegou.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 bg-emerald-500/15 text-emerald-400">qr_ready</Badge>
                <span>QR pronto para escanear. Polling continua para detectar scan.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 bg-emerald-500/15 text-emerald-400">connected</Badge>
                <span>Sessão ativa. Só entra aqui se <code className="bg-muted px-1 rounded">qrAvailable === false</code> (strict).</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 bg-orange-500/15 text-orange-400">stale</Badge>
                <span>Sessão travada — worker respondeu mas sem QR após 2 polls.</span>
              </div>
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5 bg-destructive/15 text-destructive">error</Badge>
                <span>Falha na API, timeout, ou payload inválido.</span>
              </div>
            </div>
          </section>

          {/* Regra de prioridade */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">⚡ Regra de Prioridade (Verdade de Exibição)</h4>
            <div className="mt-1 font-mono text-[10px] bg-muted p-3 rounded space-y-1">
              <p>1. error/commandFailed → <strong>error</strong></p>
              <p>2. hasRealQr (imagem/texto) → <strong>qr_ready</strong></p>
              <p>3. qrAvailable === true && !hasRealQr → <strong>awaiting_qr</strong></p>
              <p>4. needsQr === true → <strong>awaiting_qr</strong></p>
              <p>5. hasSession && qrAvailable === <strong>false</strong> → connected</p>
              <p>6. session.status === "connected" && qrAvailable === <strong>false</strong> → connected</p>
              <p>7. commandDone && !hasRealQr → stale (após 2 polls)</p>
              <p>8. pending/processing → pending</p>
              <p>9. fallback → awaiting_qr</p>
            </div>
            <p className="mt-2"><strong>Regra chave:</strong> <code className="bg-muted px-1 rounded">qrAvailable === false</code> (strict). Se <code className="bg-muted px-1 rounded">qrAvailable</code> for <code className="bg-muted px-1 rounded">undefined</code>, NÃO assume connected.</p>
          </section>

          {/* Fluxo */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">🔄 Fluxo Completo</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li><strong>idle</strong> → Usuário clica "Gerar QR"</li>
              <li>Se sessão existente (connected/stale/error) → auto-reset → <strong>resetting</strong></li>
              <li>Insere comando <code className="bg-muted px-1 rounded">get_qr</code> → <strong>pending</strong></li>
              <li>Worker pega comando → <strong>awaiting_qr</strong></li>
              <li>Worker gera QR e grava em events → <strong>qr_ready</strong></li>
              <li>Polling continua em qr_ready (até 120s) para detectar scan</li>
              <li>Usuário escaneia → worker seta <code className="bg-muted px-1 rounded">qrAvailable: false</code> + <code className="bg-muted px-1 rounded">hasSession: true</code> → <strong>connected</strong></li>
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
              <p><strong>Flags canônicas:</strong></p>
              <p className="ml-2">• qrAvailable: true = QR pendente, false = sem QR</p>
              <p className="ml-2">• hasSession: true = bot conectado</p>
              <p className="ml-2">• needsQr: true = precisa gerar QR</p>
            </div>
          </section>

          {/* Reset */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">🧹 Reset de Sessão</h4>
            <p>O reset segue o fluxo assíncrono:</p>
            <ol className="list-decimal list-inside space-y-1 mt-1">
              <li>UI → <strong>resetting</strong> (spinner)</li>
              <li>Insere comando <code className="bg-muted px-1 rounded">reset_session</code></li>
              <li>Deleta todos os events antigos</li>
              <li>Deleta commands finalizados (done/error)</li>
              <li>Atualiza <code className="bg-muted px-1 rounded">wa_hub_iso_sessions.status = 'reset'</code></li>
              <li>UI → <strong>idle</strong> (pronto para novo QR)</li>
            </ol>
            <p className="mt-2"><strong>Auto-reset:</strong> Ao clicar "Gerar QR" com sessão <code className="bg-muted px-1 rounded">connected</code>, <code className="bg-muted px-1 rounded">stale</code> ou <code className="bg-muted px-1 rounded">error</code>, o reset é feito automaticamente antes de gerar novo QR.</p>
          </section>

          {/* Worker */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">⚙️ Como rodar o Worker</h4>
            <p>O worker é um servidor Node.js rodando localmente (ou em VPS) que:</p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li>Faz polling em <code className="bg-muted px-1 rounded">wa_hub_iso_commands</code> a cada 2-5s filtrando por <code className="bg-muted px-1 rounded">tenant_id</code> e <code className="bg-muted px-1 rounded">status = 'pending'</code></li>
              <li>Processa ações: <code className="bg-muted px-1 rounded">get_qr</code>, <code className="bg-muted px-1 rounded">send_message</code>, <code className="bg-muted px-1 rounded">reset_session</code></li>
              <li>Grava resultados em <code className="bg-muted px-1 rounded">wa_hub_iso_events</code> e/ou atualiza o <code className="bg-muted px-1 rounded">result</code> do command</li>
              <li><strong>IMPORTANTE:</strong> Worker DEVE setar <code className="bg-muted px-1 rounded">qrAvailable: false</code> após scan bem-sucedido para que o front mude para "connected"</li>
            </ul>
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
                <p className="font-medium text-foreground">Mostra "Conectado" mas não está:</p>
                <ul className="list-disc list-inside ml-2">
                  <li>Worker precisa enviar <code className="bg-muted px-1 rounded">qrAvailable: false</code> explicitamente</li>
                  <li>Se <code className="bg-muted px-1 rounded">qrAvailable</code> for <code className="bg-muted px-1 rounded">undefined</code>, o front NÃO assume connected</li>
                  <li>Use "Limpar Sessão" → "Gerar QR" para forçar nova sessão</li>
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
                <p className="font-medium text-foreground">QR aparece mas não muda para "Conectado" após scan:</p>
                <ul className="list-disc list-inside ml-2">
                  <li>Polling continua por 120s após QR ser exibido</li>
                  <li>Worker precisa atualizar <code className="bg-muted px-1 rounded">qrAvailable: false</code> + <code className="bg-muted px-1 rounded">hasSession: true</code></li>
                  <li>Verifique os logs do worker para confirmar que o scan foi detectado</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
