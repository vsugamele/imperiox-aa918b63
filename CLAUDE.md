# CLAUDE.md — Diretrizes de Desenvolvimento e Contexto da IA

> **Referência Operacional Completa:** Consulte [OPERACAO.md](file:///C:/Users/vsuga/.gemini/antigravity/scratch/imperiox/OPERACAO.md) para regras de negócio dos sócios, produtos e esteiras ativas.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Radix UI, Lucide Icons, React Router DOM.
- **Backend / Infra:** Supabase (PostgreSQL, Auth, Edge Functions com Deno, Realtime, Storage).
- **Provedor WhatsApp:** Evolution API conectada ao Supabase via `imphq_wa_providers`.
- **MCP Server:** `project-mcp` (ferramentas de IA para ler e desenhar fluxos e runbooks).

---

## 🚀 Comandos Essenciais

```bash
# Desenvolvimento local
npm run dev

# Checagem estrita de tipos TypeScript (OBRIGATÓRIO antes de commitar)
npx tsc --noEmit

# Build de produção
npm run build

# Deploy de Edge Function no Supabase
npx supabase functions deploy <function-name> --project-ref tkbivipqiewkfnhktmqq
```

---

## 🏛️ Contexto dos Sócios e Projetos

- **Sócios:** Vinicius Sugamele (Tech/Copy) e Bruno - Macete Mental (Negócio/Operações).
- **Grupo de Comando WhatsApp:** `Imperio X` (JID: `120363409438175766@g.us`).
- **Projetos Principais:**
  - `jp_freitas`: Infoprodutos do expert JP Freitas (*Código dos Cortes Perfeitos* R$ 47, *Finalização Express* R$ 37, *JP Hair Education* R$ 797, *Master Cuts*).
  - `linfaflow`: DTC Saúde (*LinfaFlow X1*, *Care Room*).
  - `slimsoda`: DTC E-commerce (Whop).

---

## 📋 Regras de Arquitetura & Código

1. **Menu Global (`src/components/AppSidebar.tsx`):**
   - Deve conter **apenas ferramentas operacionais universais** (`Projetos`, `Campanhas`, `Sites`, `OpenFlow`).
   - NUNCA fixar links específicos de produtos individuais (ex: LinfaFlow ou JP) na sidebar global.
2. **Tabela de WhatsApp:**
   - SEMPRE consultar a tabela `imphq_wa_providers`. NUNCA usar referências antigas a `imphq_whatsapp_config`.
3. **Resiliência e Anti-Loop:**
   - Qualquer rotina de envio de WhatsApp deve possuir controle de tentativas e limite máximo de repetições (máx 3 falhas antes de pausar) para evitar spam de notificações.
4. **Links Relativos e Imports:**
   - Usar path alias `@/` para arquivos em `src/`.
   - Manter consistência visual com o Design System (#0A0B0D, #1B1E23, acentos em verde/lime `#D6FF4B`).
