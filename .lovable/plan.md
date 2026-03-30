

# Plano: Botão "Copiar parâmetros para Facebook Ads" no Tracker

## Problema

O usuário quer copiar rapidamente a string completa de parâmetros UTM (com macros do Facebook) para colar no campo "URL Parameters" do Facebook Ads Manager — sem precisar montar manualmente.

A imagem mostra o formato esperado:
```
utm_source=FB&utm_medium={{adset.name}}%7C{{adset.id}}&utm_campaign={{campaign.name}}%7C{{campaign.id}}&utm_content={{ad.name}}%7C{{ad.id}}&utm_term={{placement}}&xcod=...
```

## Solução

Adicionar na seção de "Prévia do parâmetro" (linha ~522 do `Tracker.tsx`) um botão **"📋 Copiar para Facebook Ads"** que gera apenas a query string (sem a URL de destino) no formato que o Facebook espera — com `%7C` (pipe encoded) separando nome e ID das macros, e incluindo um campo `xcod` para tracking avançado.

### Mudanças em `src/pages/Tracker.tsx`

1. **Nova função `buildFbAdsParams()`** que monta a string de parâmetros otimizada para Facebook Ads:
   - `utm_source=FB`
   - `utm_medium={{adset.name}}%7C{{adset.id}}`
   - `utm_campaign={{campaign.name}}%7C{{campaign.id}}`
   - `utm_content={{ad.name}}%7C{{ad.id}}`
   - `utm_term={{placement}}`
   - `xcod=` com hash de tracking concatenando macros (como na imagem)

2. **Botão "Copiar para FB Ads"** ao lado do preview, que chama `navigator.clipboard.writeText()` com a string gerada.

3. **Seção "Prévia do parâmetro"** expandida: exibir a string formatada em bloco `break-all` para o usuário conferir antes de copiar.

4. O botão só aparece quando a plataforma selecionada for "Meta Ads".

### Arquivo alterado

| Arquivo | Ação |
|---|---|
| `src/pages/Tracker.tsx` | Função `buildFbAdsParams()`, botão copiar, prévia expandida |

