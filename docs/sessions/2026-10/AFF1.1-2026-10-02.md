# Handoff — AFF1.1 — 02/10/2026

## Feito

Usuário escolheu validar Leaftide primeiro e replicar. Quatro ofertas H&W aprovadas conferidas, com IDs/checkouts de afiliado. Fontes e links existentes identificados antes de novas cópias.

Links publicados, players, GitHub e H&W organizados no Briefing dos quatro projetos, conferidos na interface. Cadastros existentes e legados preservados; links legados sinalizados. Dez sites publicados cadastrados, sem migração de schema.

Quatro repositórios privados publicados por escopo @devops, com fonte existente, catálogo e manifesto dos materiais. Fonte Leaftide/Slim depende do tracker público existente; chaves locais não foram versionadas. SlimSoda inclui quatro advertoriais e PDP v3 com assets em materials/. Repositórios MemoFlow ADV01/Eleanor/PDP existentes reutilizados.

Vturb: oito players conferidos. Novos CTAs salvos/habilitados MemoFlow 55:00 e SlimSoda Powder 37:06 para DTC H&W com affid=aff_6821377. Nenhum botão existente removido. Leaftide/CardioFlush atuais preservados.

Catalogados 25 ZIPs/RARs locais; três pares ADS TEXT(S)/(1) duplicados por SHA256. Nenhum material original excluído. Arquivos grandes não enviados ao GitHub. A identidade com downloads H&W permanece a conferir.

## Estado atual

Catálogo: [affiliate-offers-2026-10-02.md](../../operations/affiliate-offers-2026-10-02.md).

Leaftide 11, CardioFlush 16, MemoFlow 18, SlimSoda 19 links no Briefing. Fonte VSL MemoFlow privada, ainda não publicada; config.js mantém checkout/legal vazios. SlimSoda tem CTA novo Vturb, mas fluxo público até checkout ainda não testado.

Pixel Leaf 3404268439746053 em Leaftide ML01; Clear 1427772126180988 em CardioFlush LEAD1. Demais players sem pixel observado. Não confirmada propriedade/BM/eventos.

BM candidata Imperio Company 1895345497616474; AD Vini 01 448271424884723; dataset Slim 996492073462713 sem eventos observados. Meta redireciona à 2FA da conta Bruno Souza de Carvalho; usuário disse que autenticaria e avisaria, sem liberação confirmada.

## Validação

Typecheck aprovado depois do commit paralelo STR1.9. Lint 0 erros/2 avisos existentes. 623 testes aprovados em 91 arquivos. Nenhum código do aplicativo modificado ou deployado nesta story. Sintaxe JS externa/inline das cópias conferida e scan de credenciais das fontes versionadas realizado.

Evidências locais: C:/Users/vsuga/Downloads/imperio-ofertas/evidencias/memoflow-vturb-cta.png e slimsoda-vturb-cta.png. Browser Chrome ID 4 (perfil Vinicius). Para retomar UI, leia documentação CUA; abas antigas podem estar sem debugger. Abas novas funcionaram. Screenshots funcionaram com getScreenshot(), enquanto screenshot() CDP travou.

## Próximas ações / bloqueadores

1. Usuário completar 2FA diretamente na Meta; conferir qualidade/propriedade/permissões do ativo antes de pixel/CAPI.
2. Aguardar escolha de checkout dos funis Leaftide/CardioFlush: versões isoladas H&W (recomendado), substituir publicados, ou manter existentes. AGENTS exige confirmação para alterar algo funcionando.
3. Concluir checkout/legal e publicar VSL MemoFlow na direção aprovada; validar cliques/afiliado/eventos sem compra ou campanha implícita.
4. Validar fluxo público SlimSoda após 37:06; revisar botão antigo desativado e coexistência com CTA Vturb.
5. Revisar CTAs/pitches CardioFlush e ML04 conforme escolha; não declarar funis prontos para tráfego enquanto estes pontos estiverem pendentes.

## Git / escopo

Root trabalha em feat/operacao-diaria com alteração STR1.9 paralela. Commitar apenas arquivos desta story. Não incluir supabase/.temp/cli-latest, .claude/launch.json, AGENTS.md ou deno.lock de outras tarefas; não empurrar commits alheios.

Copias da oferta: C:/Users/vsuga/Downloads/imperio-ofertas/{leaftide-powder-vsl,cardioflush-vsls,memoflow-vsl,slimsoda-powder-vsl}. Originais permanecem em Produtos Bifi.
