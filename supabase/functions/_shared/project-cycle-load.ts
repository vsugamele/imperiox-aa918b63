import { buildProjectCycle, type CycleSource } from "./project-cycle.ts";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown };
export interface CycleQuery extends PromiseLike<Result> {
  select(columns: string): CycleQuery;
  eq(column: string, value: unknown): CycleQuery;
  in(column: string, values: unknown[]): CycleQuery;
  gte(column: string, value: unknown): CycleQuery;
  lt(column: string, value: unknown): CycleQuery;
  order(column: string, options: { ascending: boolean }): CycleQuery;
  limit(count: number): CycleQuery;
  maybeSingle(): PromiseLike<Result>;
}
export interface CycleDb { from(table: string): CycleQuery }
export interface CycleReaders {
  live(): Promise<unknown>;
  kit(): Promise<unknown>;
  briefing(): Promise<unknown>;
}
const obj = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const rows = (v: unknown): Row[] => Array.isArray(v) ? v.map(obj) : [];
const str = (v: unknown): string => typeof v === "string" ? v : "";
const message = (v: unknown): string => v instanceof Error ? v.message : str(obj(v).message) || "Falha ao consultar fonte";
const MAX_ROWS = 100;
function safeData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeData);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(obj(value)).map(([key, item]) =>
    [key,
      /token|password|secret|api.?key|authorization|credential/i.test(key) ? "[redacted]" : safeData(item)]));
  return value;
}

/** Sources are bounded and explicitly project-scoped. A failed query never becomes an empty inventory. */
export async function loadProjectCycle(db: CycleDb, projectId: string, readers: CycleReaders, objective?: string | null, now = new Date()) {
  const projectRes = await db.from("imphq_projects").select("id,name,avatar,data,clarity_id,ga_id,updated_at")
    .eq("id", projectId).maybeSingle();
  if (projectRes.error) throw new Error(message(projectRes.error));
  const project = obj(safeData(projectRes.data));
  if (project.id !== projectId) throw new Error("Projeto não encontrado");
  const iso = now.toISOString();
  const brt = new Date(now.getTime() - 3 * 3600000);
  const start = `${brt.toISOString().slice(0, 10)}T03:00:00.000Z`;
  const sources: CycleSource[] = [{ key: "project", status: "available", origin: "imphq_projects", observed_at: iso, data: project }];
  async function source(key: string, origin: string, read: () => PromiseLike<unknown>, maxAgeDays?: number) {
    try {
      const raw = await read();
      const result = obj(raw);
      if ("error" in result && result.error) throw result.error;
      const data = "data" in result ? result.data : raw;
      const list = Array.isArray(data) ? rows(data) : null;
      const missing = data == null || (list !== null && list.length === 0);
      const dates = (list ?? [obj(data)]).map(r => Date.parse(str(r.updated_at || r.created_at || r.data_ref))).filter(Number.isFinite);
      const stale = !missing && maxAgeDays !== undefined && (!dates.length || now.getTime() - Math.max(...dates) > maxAgeDays * 86400000);
      const item: CycleSource = { key, origin, observed_at: iso, status: missing ? "missing" : stale ? "stale" : "available", data };
      if (list?.length === MAX_ROWS) item.problem = `Leitura limitada a ${MAX_ROWS} registros; inventário pode estar incompleto.`;
      sources.push(item);
      return item;
    } catch (error) {
      const item: CycleSource = { key, origin, observed_at: iso, status: "error", data: null, problem: message(error) };
      sources.push(item);
      return item;
    }
  }
  const [sites, , , , , , , kit, , , , ads, sales, journal] = await Promise.all([
    source("sites", "imphq_project_sites → imphq_sites", async () => {
      const linked = await db.from("imphq_project_sites").select("site_id,papel").eq("projeto_id", projectId).limit(MAX_ROWS);
      if (linked.error) throw linked.error;
      const links = rows(linked.data);
      if (!links.length) return { data: [], error: null };
      const res = await db.from("imphq_sites").select("id,titulo,url,tipo,status,updated_at").in("id", links.map(r => r.site_id)).limit(MAX_ROWS);
      if (res.error) throw res.error;
      return { data: rows(res.data).map(r => ({ ...r, papel: links.find(l => l.site_id === r.id)?.papel })), error: null };
    }),
    source("references", "imphq_referencias", () => db.from("imphq_referencias").select("id,titulo,url,tipo,produto,updated_at").eq("project_id", projectId).order("updated_at", { ascending: false }).limit(MAX_ROWS)),
    source("knowledge", "imphq_skill_outputs (metadados; conteúdo pela skill/etapa)", () => db.from("imphq_skill_outputs").select("id,skill_id,skill_nome,produto,created_at,outcome_score").eq("project_id", projectId).order("created_at", { ascending: false }).limit(MAX_ROWS)),
    source("goals", "imphq_project_goals (mês BRT)", () => db.from("imphq_project_goals").select("id,ano,mes,meta_receita,meta_leads,meta_roas,meta_vendas,observacoes,updated_at").eq("project_id", projectId).eq("ano", brt.getUTCFullYear()).eq("mes", brt.getUTCMonth() + 1).limit(MAX_ROWS)),
    source("competitors", "imphq_competitors", () => db.from("imphq_competitors").select("id,name,url").eq("project_id", projectId).limit(MAX_ROWS)),
    source("map", "imphq_company_map_nodes", () => db.from("imphq_company_map_nodes").select("id,label,kind,step_status,linked_skill_id,notes,url").eq("linked_project_id", projectId).limit(MAX_ROWS)),
    source("live", "get_live_panel", readers.live),
    source("kit", "get_project_kit", readers.kit),
    source("briefing", "get_briefing", readers.briefing),
    source("rounds", "imphq_scale_rounds", () => db.from("imphq_scale_rounds").select("id,fase,rodada,resultado,updated_at").eq("project_id", projectId).order("updated_at", { ascending: false }).limit(MAX_ROWS)),
    source("clarity", "imphq_metrics_daily (agregados; sem heatmap/replay)", () => db.from("imphq_metrics_daily").select("data_ref,scroll_depth_medio,updated_at").eq("project_id", projectId).eq("source", "clarity").order("data_ref", { ascending: false }).limit(MAX_ROWS), 2),
    source("ads_currency", "imphq_ads_spend (hoje BRT)", () => db.from("imphq_ads_spend").select("moeda").eq("project_id", projectId).eq("data_ref", start.slice(0, 10)).limit(MAX_ROWS)),
    source("sales_currency", "imphq_vendas aprovadas (hoje BRT)", () => db.from("imphq_vendas").select("data").eq("project_id", projectId).eq("status", "aprovado").gte("created_at", start).lt("created_at", iso).limit(MAX_ROWS)),
    source("cycle_history", "imphq_activity_log (resumo dos últimos ciclos; sem snapshots recursivos)", async () => {
      const res = await db.from("imphq_activity_log").select("id,created_at,details").eq("project_id", projectId).eq("action", "project_cycle").order("created_at", { ascending: false }).limit(MAX_ROWS);
      if (res.error) throw res.error;
      return { data: rows(res.data).map(r => ({ id: r.id, created_at: r.created_at, objective: obj(obj(r.details).cycle).objective ?? null })), error: null };
    }),
  ]);
  const money = [...rows(ads.data).map(r => str(r.moeda).trim().toUpperCase()), ...rows(sales.data).map(r => str(obj(r.data).moeda).trim().toUpperCase())];
  const mapSource = sources.find(s => s.key === "map");
  const pageKinds = new Set(["pagina_vendas", "vsl", "advertorial", "captura", "quiz", "checkout"]);
  const pages = [...rows(sites.data).map(r => ({ ...r, origin: "site_catalog" })),
    ...rows(mapSource?.data).filter(r => pageKinds.has(str(r.kind)) && /^https?:\/\//.test(str(r.url))).map(r => ({ ...r, origin: "project_map" }))];
  sources.push({ key: "pages", origin: "sites vinculados + páginas do mapa (cadastros, não validação pública)", observed_at: iso,
    status: pages.length ? "available" : sites.status === "error" || mapSource?.status === "error" ? "error" : "missing", data: pages });
  sources.push({ key: "financial_evidence", origin: "fontes monetárias do dia + saúde de sync do kit", observed_at: iso,
    status: ads.status === "error" || sales.status === "error" || kit.status === "error" ? "error" : "available",
    data: { currencies: [...new Set(money.filter(Boolean))], currency_complete: money.length > 0 && money.every(Boolean) && rows(ads.data).length < MAX_ROWS && rows(sales.data).length < MAX_ROWS,
      sync_health: obj(kit.data).saude_sync_anuncios ?? null, period_start: start, period_end: iso } });
  // Sort sources so response order is independent of network completion order.
  sources.sort((a, b) => a.key.localeCompare(b.key));
  const previous = rows(journal.data).map(r => str(r.objective)).find(Boolean) || null;
  const cycle = buildProjectCycle({ project_id: projectId, project_name: str(project.name), objective: objective?.trim() || previous,
    sources, now: iso });
  return { ...cycle, inventory_limit_per_source: MAX_ROWS, objective_origin: objective?.trim() ? "request" : previous ? "journal" : "missing",
    inventory_note: sites.status === "missing" ? "Sem sites vinculados nesta fonte; páginas do mapa e URLs cadastradas no projeto também devem ser consultadas." : "Cadastro de site não comprova publicação ou conversão." };
}

/** Primary-key insert makes replay atomic without a new queue/table. Never overwrite an earlier cycle. */
export async function recordProjectCycle(cycle: { project: unknown; objective: unknown }, cycleId: string, projectId: string,
  store: { insert(row: Row): PromiseLike<{ error: unknown }>; find(id: string): PromiseLike<Result> }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cycleId)) throw new Error("cycle_id deve ser UUID");
  const result = await store.insert({ id: cycleId, action: "project_cycle", entity_type: "project", entity_id: projectId, project_id: projectId,
    actor: "ia", source: "project-mcp", details: { cycle } });
  if (!result.error) return { recorded: true, replay: false, cycle_id: cycleId, cycle };
  if (str(obj(result.error).code) !== "23505") throw new Error(message(result.error));
  const existing = await store.find(cycleId);
  if (existing.error) throw new Error(message(existing.error));
  const row = obj(existing.data);
  if (row.project_id !== projectId || row.action !== "project_cycle") throw new Error("cycle_id já usado em outro contexto");
  return { recorded: true, replay: true, cycle_id: cycleId, cycle: obj(row.details).cycle };
}
