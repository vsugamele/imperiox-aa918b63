# JP1.6 — Retirada do Corte EXpress do low ticket

Data: 2026-10-03 (America/Sao_Paulo).
Autorização: parar nas novas compras e retirar dos compradores antigos, verificando direitos independentes.
Responsável operacional: @data-engineer; verificação no escopo @qa.

## Alteração aplicada
- Supabase: tkbivipqiewkfnhktmqq.
- Produto: Ticto 81669, Código dos Cortes Perfeitos.
- Curso extra: f93166f9-e72c-4b66-a4d0-bc4ef7f860b1, Corte EXpress.
- Mapeamento: 1e9441e2-b536-4f5a-9891-b5fda13046bd em areamembrojp_plan_external_products, is_active=false; nota Story JP1.6 adicionada. Nota anterior era null.
- Mantidas as regras do plano Corte Express e do curso principal.
- 50 concessões em areamembrojp_user_entitlements desativadas, exclusivamente source=ticto, scope=program, curso extra e metadata.external_product_id=81669.
- Cada registro conserva metadados anteriores e recebe jp1_6_low_ticket_bonus_removal com data, story e previous_is_active=true. Nenhum registro/curso excluído.

## Evidências
- Schema completo das tabelas envolvidas, triggers e função de autorização lidos antes da alteração.
- payment-webhook publicado v81 consulta somente mapeamentos is_active=true; duas regras válidas restantes impedem fallback de entrega.
- Todos os 50 registros tinham external_product_id=81669; histórico consultado não mostrou compra aprovada de outro produto que entregasse o extra para esse grupo.
- Um aluno piloto foi alterado e verificado em transação antes dos demais 49.
- Concessões do low ticket ao extra ativas após correção: zero.
- Acesso efetivo ao extra removido para 49 alunos; 1 conserva direito por admin_grant de escopo all.
- Acesso efetivo ao curso principal confirmado para todos os 50 pela função amjp_has_program_access.
- Concessões legacy_csv do curso extra preservadas: 642.
- Hash MD5 determinístico de todos os demais registros de acesso: 88b2fbf706caf80941a1d3c26df5b44d, idêntico antes/depois.
- Transações incluíram assertions de quantidade, acesso principal, direitos independentes e integridade dos registros fora do alvo.
- npx tsc --noEmit: passou. Lint/testes de aplicação não executados: nenhuma alteração de código; validação relevante realizada no banco real.

## Reversão, somente se autorizada
Reativar o mapeamento identificado acima e remover sua nota JP1.6 (nota original null). Reativar somente os entitlements com metadata.jp1_6_low_ticket_bonus_removal.story=JP1.6 e anteriores is_active=true, removendo essa chave de auditoria. Conferir novamente os direitos efetivos. Não executar reversão automaticamente; pagamentos/reembolsos posteriores precisam ser considerados.

## Estado e limites
Correção de configuração e concessões concluída em produção. Curso extra continua publicado para quem tem outro direito. Nenhum envio a alunos, compra de teste, mudança de frontend ou deploy. Não houve teste de login na sessão de um aluno; o acesso foi verificado diretamente pela função de autorização do banco.
