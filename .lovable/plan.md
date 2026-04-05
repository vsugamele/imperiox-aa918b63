

# Diagnostico: Cached Egress Excedendo (307 GB / 250 GB)

## O que esta acontecendo

Suas screenshots do Supabase mostram:

1. **`mc_imphq_community_chat`** — **4.041 requests GET em 1 hora** (select com limit 60)
2. **`mc_imphq_user_interactions`** — **189 requests POST retornando 401** (erro de autorizacao)

Essas duas tabelas **nao sao usadas neste projeto Lovable**. Procurei no codigo inteiro e nenhum componente faz query nelas. O prefixo `mc_` sugere que vem de **outro aplicativo** conectado ao mesmo projeto Supabase (possivelmente uma comunidade/app externo).

## Causa raiz

A tabela `community_chat` esta sendo consultada **~4.000 vezes por hora** por uma aplicacao externa. Cada request retorna ate 60 registros. Se cada registro tiver ~2-5 KB de dados, isso gera:

```text
4.000 req/hora × 60 rows × 3 KB ≈ 720 MB/hora ≈ 17 GB/dia ≈ 510 GB/mes
```

Isso sozinho ja estoura o limite de 250 GB.

## O que fazer (fora do Lovable)

Este problema esta **fora do escopo deste projeto** — vem de outro app. As acoes necessarias sao:

1. **Identificar qual app faz essas queries** — provavelmente um chat/comunidade com polling agressivo (a cada ~1 segundo)
2. **Reduzir a frequencia de polling** nesse app para pelo menos 10-30 segundos
3. **Usar Supabase Realtime** em vez de polling para o chat — isso elimina as queries repetitivas
4. **Corrigir os 401** no `user_interactions` — o app esta tentando inserir sem autenticacao valida, gerando 189 erros/hora desnecessarios

## Neste projeto Lovable

Os pollings deste projeto ja estao otimizados:
- WhatsApp ChatView: 30s
- useWaSession: 2.5s (so ativo quando gerando QR, para automaticamente)

Nao ha mudancas necessarias aqui.

