## Correções de build

**1. `src/components/skills/SkillPipelines.tsx` (linha 241)**
`PostgrestFilterBuilder` (do `.insert()`) é thenable mas não tem `.catch()`. Envolver em `try/catch` ou usar `.then(undefined, () => {})`:

```ts
await supabase.from("imphq_skill_outputs").insert({ ... }).then(undefined, () => {});
```

**2. `src/pages/InstagramPage.tsx` (linha 1598)**
JSX está interpretando `{nome}` como expressão. Escapar como string literal:

```tsx
<label className="text-[10px] uppercase font-bold text-muted-foreground">
  1º Mensagem (use {"{nome}"} para personalizar)
</label>
```

Depois disso, retomo a lista de melhorias que comecei.
