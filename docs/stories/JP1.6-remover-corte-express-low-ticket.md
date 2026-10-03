# Story JP1.6 — Retirar Corte EXpress da entrega do low ticket

Responsável: @data-engineer (dados), @qa (validação).
Autorização: usuário escolheu parar nas novas compras e retirar dos compradores antigos, preservando outros direitos de acesso.

## Critérios de aceitação
- [x] Conferir schema completo das tabelas envolvidas e código publicado de liberação.
- [x] Desativar somente o vínculo Ticto 81669 → Corte EXpress.
- [x] Validar um acesso real antes de processar os demais.
- [x] Identificar acessos originados do produto 81669; preservar direitos independentes e importações antigas.
- [x] Conferir acesso efetivo pela função de autorização publicada após a correção.
- [x] Registrar resultado e procedimento reversível, sem excluir cursos ou registros.

## File List
- docs/stories/JP1.6-remover-corte-express-low-ticket.md
- docs/sessions/2026-10/2026-10-03-jp-corte-express-low-ticket.md

## Estado
Concluído no banco de produção em 2026-10-03. Vínculo extra desativado; 50 concessões do produto 81669 desativadas, 49 alunos sem o extra e 1 com acesso preservado por admin_grant de escopo all. Curso principal preservado para os 50; 642 concessões legacy_csv preservadas. Hash de todos os outros registros de acesso idêntico antes/depois. Piloto real validado antes do conjunto. Verificação via amjp_has_program_access; nenhuma mudança de código da aplicação ou schema. npx tsc --noEmit passou. Handoff contém identificação precisa e rollback.
