# CSX1.5 — Cinna no editor nativo

Opção 1 aprovada: reutilizar editor Canvas, persistência e execução OpenFlow. Preservar configuração e sessões anteriores; não ativar canais.

- [x] Mapear editor, ações, configuração real e contratos do executor.
- [x] Converter roteiro salvo em mensagens e esperas nativas, com identidade estável.
- [x] Preservar classificação restrita, dúvida sem avanço, parada e transferência humana.
- [x] Abrir Cinna pelo mesmo editor e validar edição/persistência.
- [x] Testar conversão, runtime, lint, tipos e build.
- [ ] Publicar e verificar no endereço habitual.

Arquitetura: imphq_automacoes.acoes torna-se a fonte do roteiro operacional. Mensagens nativas whatsapp usam o canal da automação; cada wait_reply contém cinna_stage, e o primeiro contém cinna_policy (oferta, respostas aprovadas, modelo). O adaptador reconstrói a configuração das ações editadas e usa a política determinística existente. Não enviar textos da próxima etapa duas vezes. Retomada deve vincular a execução e confirmar envio antes de avançar. Fluxo começa inativo, sem checkout aprovado, sem novas tabelas. A configuração anterior fica preservada como origem histórica; acesso principal redireciona ao editor nativo. Instagram depende de integração existente compatível e não será declarado conectado.

File List: docs/sessions/2026-09/cinna-native-openflow.md.
