import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Ficha, TipoAvatar } from "@shared/cast";

export interface CastPhoto { path: string; url: string; signed: string | null }
export interface CastAvatar {
  id: string;
  nome: string;
  tipo: TipoAvatar | null;
  papel: "elenco" | "publico" | "ambos";
  ficha: Ficha & { _fotos?: { status: string; erros?: string[] } };
  ativo: boolean;
  origem: string;
  fotos: CastPhoto[];
}

/** Elenco do projeto (OPS1.5) com links assinados das fotos (bucket privado avatar-refs). */
export function useCast(projectId: string | null) {
  return useQuery({
    queryKey: ["cast", projectId],
    enabled: !!projectId,
    // Enquanto algum avatar está gerando fotos, atualiza a cada 10 s.
    refetchInterval: (q) => ((q.state.data as CastAvatar[] | undefined)?.some((a) => a.ficha?._fotos?.status === "gerando") ? 10_000 : false),
    queryFn: async (): Promise<CastAvatar[]> => {
      const { data, error } = await supabase.from("imphq_avatar_studio_projects")
        .select("id, nome, tipo, papel, ficha, ativo, origem, avatar_photos").eq("project_id", projectId as string).order("created_at");
      if (error) throw error;
      const rows = data ?? [];
      const paths = rows.flatMap((r) => (Array.isArray(r.avatar_photos) ? r.avatar_photos : []))
        .map((p) => (p && typeof p === "object" ? String((p as { path?: unknown }).path ?? "") : ""))
        .filter((p) => p && !p.startsWith("external:"));
      const signed = new Map<string, string>();
      if (paths.length) {
        const { data: s } = await supabase.storage.from("avatar-refs").createSignedUrls(paths, 60 * 60);
        for (const x of s ?? []) if (x.path && x.signedUrl) signed.set(x.path, x.signedUrl);
      }
      return rows.map((r) => ({
        id: r.id, nome: r.nome, tipo: (r.tipo as TipoAvatar | null) ?? null, papel: (r.papel as CastAvatar["papel"]) ?? "elenco",
        ficha: (r.ficha && typeof r.ficha === "object" ? r.ficha : {}) as CastAvatar["ficha"], ativo: r.ativo !== false, origem: r.origem,
        fotos: (Array.isArray(r.avatar_photos) ? r.avatar_photos : []).flatMap((p) => {
          if (!p || typeof p !== "object") return [];
          const path = String((p as { path?: unknown }).path ?? "");
          const url = String((p as { url?: unknown }).url ?? "");
          return path ? [{ path, url, signed: signed.get(path) ?? (path.startsWith("external:") ? url : null) }] : [];
        }),
      }));
    },
  });
}

export interface NewAvatar { project_id: string; nome: string; tipo: TipoAvatar; papel: CastAvatar["papel"]; ficha: Ficha }

export function useSaveAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: NewAvatar) => {
      if (!a.nome.trim()) throw new Error("Dê um nome ao avatar");
      const { error } = await supabase.from("imphq_avatar_studio_projects").insert({
        project_id: a.project_id, nome: a.nome.trim(), tipo: a.tipo, papel: a.tipo === "publico" ? "publico" : a.papel, ficha: a.ficha as unknown as Json, origem: "manual",
      });
      if (error) throw error;
    },
    onSuccess: (_d, a) => qc.invalidateQueries({ queryKey: ["cast", a.project_id] }),
  });
}

export function useToggleAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean; project_id: string }) => {
      const { error } = await supabase.from("imphq_avatar_studio_projects").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["cast", v.project_id] }),
  });
}

async function castStudio<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("cast-studio", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

/** A IA propõe e grava o elenco (persona do público + elenco visual), ainda sem fotos. */
export function useSuggestCast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { project_id: string; produto?: string; publico?: string; quantidade?: number }) => castStudio<{ salvos: Array<{ id: string }> }>({ modo: "sugerir", salvar: true, ...input }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["cast", v.project_id] }),
  });
}

/** Gera fotos de referência da mesma pessoa (retrato base + variações) na Kie. */
export function useGenerateCastPhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { avatar_id: string; project_id: string; quantidade?: number }) => castStudio<{ gerando: number }>({ modo: "fotos", avatar_id: input.avatar_id, quantidade: input.quantidade ?? 4 }),
    onSuccess: (_d, v) => setTimeout(() => qc.invalidateQueries({ queryKey: ["cast", v.project_id] }), 1500),
  });
}

/** Nomes dos avatares (para o placar por avatar). */
export function useAvatarNames(ids: ReadonlyArray<string>) {
  const key = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ["avatar-names", key],
    enabled: key.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("imphq_avatar_studio_projects").select("id, nome").in("id", key);
      if (error) throw error;
      return new Map((data ?? []).map((a) => [a.id, a.nome]));
    },
  });
}
