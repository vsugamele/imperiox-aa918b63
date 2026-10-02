// Cliente HTTP da API do GeeLark (modo token). `fetch` injetável para teste.
// Doc: github.com/GeeLark/geelark-openapi — POST + JSON, cabeçalho traceId (UUID v4) e Authorization: Bearer <token>.
// Limite da API: 200 req/min e 24.000/h; estourar trava a conta da API por 2 h, por isso o worker trabalha em lotes pequenos.

export const GEELARK_BASE_URL = "https://openapi.geelark.com";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class GeelarkError extends Error {
  constructor(public code: number, message: string) {
    super(`GeeLark ${code}: ${message}`);
  }
}

export interface GeelarkClient {
  call<T = unknown>(path: string, body: Record<string, unknown>): Promise<T>;
  /** Copia um arquivo público (ex.: vídeo no Storage) para o armazenamento temporário do GeeLark e devolve a URL que as tarefas aceitam. */
  uploadFromUrl(sourceUrl: string, fileType: string): Promise<string>;
  queryTasks(ids: string[]): Promise<Array<{ id: string; status: number; failCode?: number; failDesc?: string; shareLink?: string }>>;
}

export function geelarkClient(token: string, fetchImpl: FetchLike = fetch): GeelarkClient {
  const call = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
    const res = await fetchImpl(`${GEELARK_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", traceId: crypto.randomUUID().toUpperCase(), Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: { code?: number; msg?: string; data?: unknown };
    try { json = JSON.parse(text); } catch { throw new GeelarkError(res.status, `resposta não-JSON: ${text.slice(0, 200)}`); }
    if (!res.ok || json.code !== 0) throw new GeelarkError(json.code ?? res.status, json.msg || `HTTP ${res.status}`);
    return json.data as T;
  };

  return {
    call,
    async uploadFromUrl(sourceUrl, fileType) {
      const { uploadUrl, resourceUrl } = await call<{ uploadUrl: string; resourceUrl: string }>("/open/v1/upload/getUrl", { fileType });
      const source = await fetchImpl(sourceUrl);
      if (!source.ok) throw new Error(`Não foi possível baixar o arquivo (${source.status}): ${sourceUrl}`);
      const put = await fetchImpl(uploadUrl, { method: "PUT", body: await source.arrayBuffer() });
      if (!put.ok) throw new Error(`Upload para o GeeLark recusado (${put.status})`);
      return resourceUrl;
    },
    async queryTasks(ids) {
      if (!ids.length) return [];
      const data = await call<{ items?: Array<{ id: string; status: number; failCode?: number; failDesc?: string; shareLink?: string }> }>("/open/v1/task/query", { ids: ids.slice(0, 100) });
      return data?.items ?? [];
    },
  };
}
