# CSX1.7 — Jornada comercial e mídias da Ana

Pedido: aplicar lacunas identificadas no Typebot fornecido em 08/09. Liderança de implementação: @dev; publicação remota exclusiva de @devops.

Opções: 1. conversa adaptada com roteiro aprovado (selecionada); 2. Typebot literal; 3. geração livre.

## Arquitetura

Reutilizar nove etapas, executor nativo, snapshots, CAS, deduplicação e compositor restrito. Não criar tabelas. Capturas opcionais nas etapas guardam apenas respostas fornecidas, limitadas em tamanho, no estado da própria execução. Não inferir diagnóstico, adequação ou benefícios a partir dessas respostas. Contexto é dado não confiável, nunca instrução. Perguntas, recusas, emergência e pedidos humanos continuam com precedência; campos antigos continuam válidos. Editor preserva metadados opcionais.

Revisar copy para acolhimento, objetivo, experiência, rotina, objeção e oferta. Texto e pausas pertencem às ações nativas. Preservar IDs existentes e layout. Material original: seis áudios de instruções de produção, infográfico com claims não comprovados, depoimento sem origem e vídeo sem URL; não publicar esses itens como prova. Preparar substituições finais e usar integração de voz existente se disponível. Não configurar preço/checkout fictícios nem ativar canais.

## Critérios

- [x] Comparar export, código, revisão prévia de mídias e automação real.
- [x] Revisar nove etapas, perguntas e respostas a objeções.
- [x] Captura limitada e contextualização sem inferências clínicas; compatibilidade de snapshots.
- [x] Preparar mídias finais, registrar geração e validação ou bloqueador concreto.
- [x] Configurar pausas nativas e conferir sequência.
- [x] Testar casos comuns, recusa, urgência, deduplicação, captura e mídia; lint/typecheck/test/build.
- [x] Atualizar uma automação com CAS, preservando oferta/ativo/layout.
- [x] Publicar e conferir; registrar handoff e pendências reais.

## Fontes

Export fornecido; brief do produto; revisão local de mídias CSX1.2. Educação: https://www.nccih.nih.gov/health/diabetes-and-dietary-supplements-what-you-need-to-know (consultado em 08/09/2026). Evidência de ingrediente não comprova eficácia do produto. Preço, frete, garantia e checkout aguardam documentação real.

## File List

Relação completa e evidências de publicação em `docs/sessions/2026-09/cinna-conversation-media.md`.
