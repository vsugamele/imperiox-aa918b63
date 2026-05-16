## Diagnóstico

Hoje o WhatsApp Hub já amarra cada provider a 1 projeto (campo `project_id` no `imphq_wa_providers`), mas a UX esconde isso e não dá controle:

1. **Card do provider** mostra só o nome da instância + "Evolution". O projeto vinculado some — não dá pra saber pra qual projeto cada linha responde.
2. **Não existe botão de excluir** provider. Quando uma instância cai/quebra, você fica com fantasma na lista (ex: "JP Freitas · Desconectado" travado).
3. **Não dá pra editar** o projeto/nome depois de criar — só recriar do zero.
4. **Sem reconectar/restart**: provider desconectado só permite copiar webhook, não consegue forçar reconexão.

## O que vou implementar

### 1. Card do provider com projeto visível e ações
Reformular o `EvolutionStatusCard` (linha 472 de `WhatsAppPage.tsx`):
- Badge claro do projeto vinculado (`📁 {projectName}`) ao lado do nome da instância
- Novo menu `⋯` no canto direito com:
  - **Trocar projeto** → Select inline com lista de projetos, salva em `imphq_wa_providers.project_id`
  - **Reconectar** (Evolution) → chama `whatsapp-api?action=restart_instance` e atualiza status
  - **Ver QR Code** (atalho que já existe na conversa, mas faltava aqui)
  - **Excluir provider** → AlertDialog de confirmação ("Isso vai remover a instância {nome}. Conversas vinculadas continuam, mas você perde o envio.") → `DELETE imphq_wa_providers WHERE id`

### 2. Estado "Desconectado" mais acionável
- Quando `status !== "open"`, mostrar pílula "Reconectar" diretamente (não esconder atrás do menu).
- Texto explicativo curto: "Sessão perdida — clique para gerar novo QR".

### 3. Validação no Dialog de criar
- Mostrar warning se já existe provider ativo para o projeto selecionado (atualmente sobrescreve silenciosamente).
- Permitir múltiplos providers por projeto (caso queira backup), mas pedir confirmação.

## Arquivos tocados
- `src/pages/WhatsAppPage.tsx` — refatorar `EvolutionStatusCard` (+ handlers `deleteProvider`, `updateProviderProject`, `restartInstance`)
- `src/components/whatsapp/ProviderConfigDialog.tsx` — warning de duplicidade
- Sem migração (colunas já existem). Sem nova edge function (uso `whatsapp-api?action=restart_instance` que já existe; se não existir, adiciono case no `whatsapp-api/index.ts`).

## Fora do escopo
- Redesign completo das abas (Sessões/Templates/Campanhas) — mantenho o layout atual.
- Hub Local (Beta) — já tem seu próprio fluxo de exclusão.