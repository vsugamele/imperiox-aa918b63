# CSX1.6 — Atendimento consultivo da Ana

Pedido aprovado: acolher dúvidas e preocupações, conversar sobre o que a pessoa trouxe e apresentar o suplemento quando houver interesse. Preservar o fluxo nativo do Império.

Opções consideradas: 1. roteiro consultivo com respostas contextuais e oferta controlada (escolhida); 2. apenas trocar textos, mantendo classificador; 3. conversa inteiramente livre. A opção 1 atende ao pedido sem retirar a autoridade do executor sobre etapas e compras.

## Arquitetura antes da implementação

Estado atual: 35 ações nativas, nove esperas, snapshot por execução, IA apenas classifica intenção. `decide` controla cursor; `planCinnaReply` prepara envio; `channel-ai-reply` confirma evento e CAS, persiste pending e envia; executor emite próxima etapa. O roteiro operacional está em `imphq_automacoes.acoes`.

Mudança: configuração opcional `consultative` na policy contém persona Ana e snippets aprovados. Converter, editor e compilador preservam esse conteúdo no snapshot. Um compositor contextual separado recebe histórico curto e a decisão determinística. Pode responder um hold ou acolher uma resposta antes do avanço; nunca decide checkout, cursor ou retomada. Hold tem no máximo uma pergunta e não reanexa automaticamente a pergunta antiga; acolhimento no advance não faz pergunta, pois a próxima etapa pertence ao executor.

Etapa awareness aguarda permissão explícita antes de apresentar o produto em curiosity. Para configurações consultivas, confirmação não é inferida de uma resposta ambígua pela IA. Urgência, pedido de orientação clínica individual e interrupção têm precedência sobre venda. Perguntas educativas gerais podem receber explicações fundamentadas; não se promete que o suplemento trata a condição relatada. Persona não inventa credenciais ou identidade humana e responde com transparência se perguntada.

Validação estrutural independente: quality_backend propôs compositor posterior à decisão e snippets no snapshot; quality_chat revisou consentimento, emissão única e ausência de CTA clínico. Configurações antigas continuam compatíveis. Não há migration, ativação de canal, inclusão de preço/checkout ou geração de áudio nesta mudança.

## Critérios e testes

- [x] Mapear implementação e consultar roteiro operacional atual.
- [x] Documentar arquitetura e revisão independente antes de editar código.
- [x] Revisar nove etapas em inglês com abertura Ana, escuta e apresentação consentida.
- [x] Responder dúvidas com contexto limitado e snippets aprovados; fallback em indisponibilidade ou saída inválida.
- [x] Preservar parada, oferta aprovada, snapshot, CAS, deduplicação e checkpoint de envio.
- [x] Verificar urgência/medicação, identidade, consentimento, pergunta única e ausência de duplicação.
- [x] Validar lint, typecheck, testes, build e Deno nos handlers alterados.
- [x] Atualizar uma automação real com comparação otimista, preservando layout e oferta.
- [ ] Publicar código e confirmar dados/tela no Império.

## Fontes e limites

NCCIH: https://www.nccih.nih.gov/health/diabetes-and-dietary-supplements-what-you-need-to-know — educação sobre suplementos; não constitui evidência de eficácia do Cinna Shield.

CDC: https://www.cdc.gov/diabetes/about/diabetic-ketoacidosis.html — sinais de alerta e atendimento urgente; triagem conversacional não é diagnóstico.

Material fornecido do produto descreve extrato de canela do Ceilão e MCT em cápsulas; quantidades, eficácia, preço, frete e condições não serão inventados. Validação lexical de geração não prova factualidade: manter base curta e fallback, testar cenários adversariais.

## File List

Atualizada no handoff `docs/sessions/2026-09/cinna-ana-consultative.md` ao concluir.
