

# Plano: Expandir lista de projetos no Hub Local

## Situacao atual

O frontend ja envia corretamente o projeto selecionado (nunca "default"). As mudancas do clawdbot sao no backend (worker + API). No front, so precisa expandir a lista.

## Mudanca

### `src/components/whatsapp/WaHubQrPanel.tsx`

Atualizar a constante `WA_PROJECTS` (linha 19-23) para incluir os novos projetos:

```typescript
const WA_PROJECTS = [
  { value: "igaming", label: "iGaming" },
  { value: "forex", label: "Forex" },
  { value: "eu", label: "EU Encapsulados" },
  { value: "crypto", label: "Crypto" },
  { value: "imobiliario", label: "Imobiliário" },
];
```

Apenas 1 arquivo, 2 linhas adicionadas.

## Futuro (quando o endpoint existir)

Quando o backend tiver `GET /api/whatsapp/projects`, trocar a constante por um fetch dinamico no mount do componente — assim novos projetos aparecem automaticamente.

