# AFF1.1 — Organizar ofertas DTC, páginas e VSLs

Status: Em andamento
Data operacional: 2026-10-02 (America/Sao_Paulo)
Liderança: @analyst; GitHub: @devops; implementação: @dev; validação: @qa.

## Solicitação e decisão

Organizar Leaftide, CardioFlush, MemoFlow e SlimSoda Powder no Império e no GitHub, com ofertas H&W, arquivos locais, advertoriais, páginas VSL, players Vturb e pixel em BM fora do JP.
Usuário escolheu opção 1: validar uma oferta primeiro e depois repetir o padrão. Piloto: Leaftide Powder.

## Critérios de aceite

- [x] Conferir estruturas existentes antes de criar novos registros.
- [x] Ler schema completo das tabelas de projetos e sites, sem propor migração.
- [x] Conferir acesso GitHub e sessões H&W/Vturb/Meta.
- [x] Validar oferta piloto com links oficiais, página pública e player.
- [x] Organizar piloto no Império preservando conteúdo anterior.
- [x] Versionar fonte piloto sem arquivos pesados ou credenciais.
- [x] Replicar inventário nas três ofertas restantes.
- [ ] Conferir BM/pixel fora do JP e documentar limitações de acesso/configuração.
- [x] Validar alterações e registrar handoff.
- [x] Conferir na interface os links dos quatro Briefings.
- [x] Salvar e habilitar CTAs novos MemoFlow e SlimSoda Powder no Vturb.
- [x] Versionar fontes e inventários em quatro repositórios privados.
- [ ] Resolver direção de checkout Leaftide/CardioFlush e validar fluxo público dos CTAs.
- [ ] Completar publicação da VSL local MemoFlow com checkout/legal verificados.

## Restrições

Preservar páginas e cadastros existentes; não excluir registros ou materiais. Não misturar MemoFlow com MemoPryl, CardioFlush com CardioClear, nem SlimSoda Powder com outras variantes. Não ativar campanhas ou realizar compras. Nenhuma credencial entra no GitHub. Dados legados divergentes permanecem identificados como pendentes de validação.

## Achados iniciais

- `ProjetoLinks` lê `label` e `url`; scripts antigos gravam `nome` e `url`, ocultando links.
- As quatro ofertas já existem em `imphq_projects`; seus links e dados VSL precisam de conferência.
- Vturb contém dois players Leaftide, um MemoFlow, um SlimSoda Powder e quatro CardioFlush.
- Leaftide Powder LT no H&W: `off_0135210`, aprovada, USD, payout front CPA USD 120 e recorrência 15%; sem arquivos nesta oferta.
- Fonte Leaftide: `Downloads/Produtos Bifi/Leaftide/deploy-leaftide`, Vercel `leaftide-powder`; sem remote Git neste diretório.
- A tela ativa `ProjetoBriefing` renderiza `data.project_links`; `ProjetoLinks` existe mas não está montado nesta tela. Catálogo piloto também copiado para `project_links` sem excluir links anteriores.
- Piloto: repositório privado `vsugamele/leaftide-powder-vsl`, commit remoto verificado `975b39b001aac532619447d8d0a63b3d86f665cd`; página original não redeployada. Tracker já publicado usado como dependência externa para não versionar chaves.
- BM candidata `Imperio Company` (`1895345497616474`), conta `AD Vini 01` (`448271424884723`), dataset `Slim` (`996492073462713`) sem eventos. Configurações da empresa exigiram 2FA da conta Bruno Souza de Carvalho. Não confirmado proprietário do pixel Leaf.
- Gates atuais do Império: lint sem erros (2 avisos), typecheck aprovado e 623 testes em 91 arquivos aprovados. Falha anterior de typecheck resolvida na alteração paralela STR1.9, sem mudança de código por esta story. Aplicativo não deployado nesta sessão.

## Entrega e dependências atuais

- Catálogo completo: docs/operations/affiliate-offers-2026-10-02.md.
- Projetos Briefing: Leaftide 11, CardioFlush 16, MemoFlow 18, SlimSoda 19 links. Dez páginas publicadas cadastradas em imphq_sites; dados legados preservados e identificados.
- GitHub privado: leaftide-powder-vsl, cardioflush-vsls, memoflow-vsl, slimsoda-powder-vsl. Fontes existentes reutilizadas; nenhuma página redeployada.
- SlimSoda: quatro advertoriais e PDP v3 originais com assets versionados em materials/, sem publicação. MemoFlow: advertoriais/PDP vinculados aos repositórios já existentes.
- Manifestos: 25 arquivos ZIP/RAR locais. Três pares de textos com (1) idênticos por SHA256. ZIPs/vídeos grandes seguem no disco; equivalência dos arquivos remotos H&W não certificada.
- MemoFlow: botão novo See Available Packages no pitch 55:00 para DTC H&W, CTA ID 6ac04ed28feef5ac589c71e7. SlimSoda Powder: 37:06, CTA ID 6ac04fa21507090c7e92954b. Salvos e habilitados, com affid=aff_6821377; eventos/fluxo público ainda pendentes.
- CardioFlush: quatro configurações Vturb conferidas. LEAD1 usa pixel Clear 1427772126180988; três outros sem pixel/CTA ligado. Leaftide ML04 sem pixel/CTA; ML01 preservado.
- Meta: nova navegação confirmou 2FA ainda exigido. Aba de autenticação preservada para usuário. BM/pixel não atribuídos como verificados.
- Pedido de decisão de checkout apresentado com três opções: cópias isoladas H&W; substituir publicados; ou manter atuais. Aguardando resposta; páginas Leaftide/CardioFlush preservadas.
- Evidências locais: Downloads/imperio-ofertas/evidencias/memoflow-vturb-cta.png e slimsoda-vturb-cta.png. Captura Vturb via wrapper nativo funcionou; captura CDP de abas antigas falhou. Briefings conferidos por UI/DOM.

## File List

- docs/stories/AFF1.1-organizacao-ofertas-dtc.md
- docs/operations/affiliate-offers-2026-10-02.md
- docs/sessions/2026-10/AFF1.1-2026-10-02.md
