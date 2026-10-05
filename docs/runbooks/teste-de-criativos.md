# Roteiro: teste de criativos (ordem de teste, TST1.1)

Do criativo ao veredito: o Império guarda o plano e o resultado; quem mexe na Meta é o operador (a IA com o MCP da Meta, ou uma pessoa no Gerenciador).

## 1. Planejar (MCP `create_test_order`)

Antes de chamar, tenha em mãos:
- o projeto e a oferta;
- a página https (com pixel e rastreador do Império);
- a conta de anúncio, a página do Facebook e o pixel;
- a verba por conjunto;
- o **payout** (quanto entra por venda) e o **CPA alvo**.

Variantes: uma por ângulo, cada uma com hipótese, arte (`image_url` pública), texto e headline. Também podem vir de um lote de referências com `referencias_lote`; nesse caso, complete os textos.

- Sem `confirmar`: devolve o plano (UTM por variante, nomes, verba total, referência da Esteira) e a lista de problemas e avisos.
- Com `confirmar=true`: grava. O status fica `pronto` se não houver problema, senão `rascunho`.

## 2. Lançar na Meta (tudo pausado)

Siga os `passos` que o `create_test_order` ou o `get_test_order` devolvem:
1. **Campanha:** objetivo vendas, ABO, sem verba na campanha.
2. **Conjuntos:** um por variante, com a verba por conjunto, otimizado para compra no pixel e público aberto.
3. **Criativos:** a arte, o texto, a headline e o `link_url` (que já leva a UTM da variante).
4. **Anúncios:** um em cada conjunto.
5. **Registro no Império:** `record_test_launch` com os ids da campanha e, por variante, do conjunto, do criativo e do anúncio.

## 3. Ligar (nível de autonomia "aprovar")

Só com o OK de alguém do time na conversa:
1. Ative na Meta de cima para baixo: campanha, depois conjuntos, depois anúncios.
2. Chame `record_test_launch` com `ativado=true` e `confirmado_por=<nome>`.
3. Se a pessoa autorizar o corte automático, passe também `corte_autorizado_por` e, se quiser, `corte_ate` (padrão: 9 dias).

## 4. Medir e cortar

Em cada leitura (por exemplo às 10h e às 19h):
1. Busque na Meta, por conjunto, o gasto, os checkouts iniciados (IC) e as compras.
2. Chame `evaluate_test_order` com as leituras. O Império:
   - soma as vendas que chegaram pela UTM, para que um ângulo não morra porque o pixel perdeu a compra;
   - dá o veredito da Esteira P1 (qualificado, mais textos, mata, cedo), mas **só decide pausar a partir do fim do dia 2**;
   - grava a leitura, o veredito e a rodada P1, que alimenta o placar de hipóteses.
3. Com `aplicar_pausas=true` e o corte autorizado no teste (ou `confirmado_por`), as variantes mortas viram `morto`. Pause na Meta os conjuntos de `pausar_na_meta`.

O corte automático nunca liga nada, nunca aumenta verba e não mexe fora do teste.

## 5. Decidir o próximo passo

- **Vencedor (qualificado):** vai para a fase 2 da Esteira, com variações de texto do mesmo ângulo.
- **Hipótese refutada:** só volta se a premissa mudar, não com criativo novo.
- Tudo fica no diário do projeto (`get_journal`) e no placar (`get_scale_rounds`).

## Ferramentas
- **MCP:** `create_test_order`, `get_test_order`, `list_test_orders`, `record_test_launch`, `evaluate_test_order`, `get_autonomy`.
- **Regra:** `supabase/functions/_shared/test-order.ts` (plano e veredito) e `_shared/scale-ladder.ts` (Esteira).
