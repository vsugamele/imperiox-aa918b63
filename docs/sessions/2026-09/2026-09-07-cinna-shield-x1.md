# Entrega local — Cinna Shield x1

Implementado no repositório C:\Users\vsuga\Downloads\imperiox-aa918b63, story CSX1.1.

Abrir com o servidor ativo: http://127.0.0.1:4318
Reiniciar: executar iniciar-simulador.ps1 nesta pasta.

## O que funciona
- Nove etapas com relação aos grupos do Typebot.
- Motor CLI e simulador usando a mesma política.
- Perguntas e objeções mantêm etapa; continuação explícita avança.
- Compra antecipada usa somente oferta aprovada; placeholder bloqueado.
- Parada e pausa para humano impedem continuação automática.
- Deduplicação/revisão/concorrência em servidor local.
- IA opcional classifica intenção, com saída restrita e fallback. Não configurada nesta sessão.

## Limites
- Nenhum canal Meta conectado e nenhuma mensagem real enviada.
- Sessões de teste em memória, sem CRM persistente.
- Copy de revisão; não é reprodução literal nem importação pronta para OpenFlow.
- Checkout/oferta pendentes.
- Seis áudios transcritos: narram orientações de criação. Não foram usados.
- Duas imagens revisadas; depoimento tem data de 14/05/2024 e origem não comprovada. Não foram usados.
- Vídeo do export é descrição em lugar de URL.

## Verificação
81 testes passaram no repositório. Lint dos arquivos TypeScript novos e typecheck estrito do motor passaram. Checagem types:check e tsconfig.app.json passaram. Sintaxe dos scripts validada. HTTP verificado com sessões reais locais, incluindo retry, conflito de revisão e concorrência. Navegador desktop e 390 px: preço mantém pergunta, continuação avança e stop desabilita envio; sem overflow mobile ou erros de console observados.
Lint global retorna 5.049 erros e 155 avisos nos arquivos existentes; não foi feita limpeza fora do escopo.

Guia de operação: scripts/cinna-shield-x1/README.md no repositório Império.
