// Gera o SQL que grava a biblioteca de playbooks (_shared/playbook-library.ts) no banco.
// Uso: npx -y deno@2 run scripts/playbooks-seed.ts > .tmp-playbooks.sql
//      npx supabase db query --linked -f .tmp-playbooks.sql
// Regrava os playbooks da biblioteca (upsert) e substitui as etapas deles; aplicações já feitas não mudam.
import { PLAYBOOK_LIBRARY } from "../supabase/functions/_shared/playbook-library.ts";

const q = (v: string | null | undefined) => (v == null ? "null" : `'${v.replace(/'/g, "''")}'`);
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const textArr = (v: string[]) => `array[${v.map(q).join(", ")}]::text[]`;
const intArr = (v: number[]) => `array[${v.join(", ")}]::integer[]`;

const out: string[] = ["begin;"];
for (const p of PLAYBOOK_LIBRARY) {
  out.push(
    `insert into public.imphq_playbooks (id, nome, familia, resumo, quando_usar, quando_evitar, horizonte, north_star, kpis, riscos, fonte, ativo, updated_at)
values (${q(p.id)}, ${q(p.nome)}, ${q(p.familia)}, ${q(p.resumo)}, ${q(p.quando_usar)}, ${q(p.quando_evitar)}, ${q(p.horizonte)}, ${q(p.north_star)}, ${json(p.kpis)}, ${textArr(p.riscos)}, ${q(p.fonte ?? null)}, true, now())
on conflict (id) do update set nome = excluded.nome, familia = excluded.familia, resumo = excluded.resumo, quando_usar = excluded.quando_usar,
  quando_evitar = excluded.quando_evitar, horizonte = excluded.horizonte, north_star = excluded.north_star, kpis = excluded.kpis, riscos = excluded.riscos,
  fonte = excluded.fonte, versao = imphq_playbooks.versao + 1, updated_at = now();`,
    `delete from public.imphq_playbook_steps where playbook_id = ${q(p.id)};`,
  );
  for (const s of p.steps) {
    out.push(`insert into public.imphq_playbook_steps (playbook_id, ordem, secao, label, kind, executor_type, skill, contrato, metrica, checklist, depende_de)
values (${q(p.id)}, ${s.ordem}, ${q(s.secao)}, ${q(s.label)}, ${q(s.kind)}, ${q(s.executor_type)}, ${q(s.skill)}, ${json(s.contrato)}, ${s.metrica ? json(s.metrica) : "null"}, ${textArr(s.checklist)}, ${intArr(s.depende_de)});`);
  }
}
out.push("commit;");
console.log(out.join("\n"));
