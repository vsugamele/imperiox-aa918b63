## Renomear "Corte Express" → "One Click" e abrir resultado no HUB

### 1. Botão e branding
`src/pages/Funis.tsx` — trocar label "Corte Express" por **"One Click"** (mantém ícone ⚡). Mostrar o botão em **todos os viewModes** (não só `funis`), já que agora ele alimenta o HUB. Default do app já é `viewMode: "hub"`, então abrir o app já mostra o destino certo.

`src/components/funis/CorteExpressModal.tsx` — renomear arquivo+componente para `OneClickModal` / `OneClickModal.tsx`, atualizar título ("⚡ One Click — Funil dentro do Hub"), toasts e textos. Atualizar import em `Funis.tsx`.

### 2. Resultado vai pro HUB
- `ProductHubCanvas` ganha prop opcional `initialProjectId`. Quando recebida, força `setProjectId(initialProjectId)` (efeito disparado ao mudar a prop).
- `Funis.tsx` guarda `hubProjectId` em estado e passa pro `<ProductHubCanvas initialProjectId={hubProjectId} … />`.
- `OneClickModal` recebe callback `onComplete(projectId)`. Quando o SSE envia `done`/`project_created`, o modal chama o callback. `Funis.tsx` faz: `setHubProjectId(id); setViewMode("hub"); load();` e fecha o modal automaticamente após ~1s (mantendo o toast de sucesso).
- Trocar o botão "Abrir projeto" do modal por **"Ver no Hub"** que apenas fecha o modal (o redirect já aconteceu).

### 3. Hub mostrando os ativos gerados
A edge `ecosystem-from-name` já grava avatar, VSL, LP, ângulos, reels, imagens e fluxos vinculados ao `project_id`. O `ProductHubCanvas` carrega de `imphq_project_hub` + blueprints por `project_id` → ao chavear pro projeto certo, o funil aparece sem mudanças no backend.

### Arquivos tocados
- `src/pages/Funis.tsx` (label, estado `hubProjectId`, callback, prop pro Hub)
- `src/components/funis/CorteExpressModal.tsx` → renomear para `OneClickModal.tsx` (rename + textos + callback)
- `src/components/funis/ProductHubCanvas.tsx` (prop `initialProjectId` + efeito de sync)

Sem mudanças na edge function nem em dados.