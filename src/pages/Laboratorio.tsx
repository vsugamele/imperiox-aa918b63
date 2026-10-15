import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FlaskRound, Star, StarOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LABORATORIO, MENU, routeKey } from "@/lib/navigation";
import { useSidebarFavorites } from "@/hooks/useSidebarFavorites";

interface Usage { rota: string; visitas: number; pessoas: number; ultima: string }

function useUsage() {
  return useQuery({
    queryKey: ["page-usage", 30],
    queryFn: async (): Promise<Usage[]> => {
      const { data, error } = await supabase.rpc("imphq_page_usage", { p_dias: 30 });
      if (error) throw error;
      return (data ?? []) as Usage[];
    },
  });
}

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—");

/**
 * Laboratório (UX1.1): tudo que saiu do menu, com o motivo e o uso real de 30 dias. Nada foi apagado — abre daqui,
 * pelo link ou pelas ações rápidas (⌘J), e dá para fixar nos favoritos do menu.
 */
export default function Laboratorio() {
  const { data: usage = [], isLoading } = useUsage();
  const { favorites, toggleFavorite } = useSidebarFavorites();
  const by = new Map(usage.map((u) => [u.rota, u]));
  const menuUrls = new Set(MENU.flatMap((g) => g.items.map((i) => i.url)));
  const menuSemUso = MENU.flatMap((g) => g.items).filter((i) => !by.get(routeKey(i.url)));
  const medindoDesde = usage.length ? null : "hoje";

  return (
    <div className="space-y-6">
      <header>
        <div className="kicker">Sistema</div>
        <h1 className="section-title mt-1 flex items-center gap-2 text-2xl md:text-3xl"><FlaskRound className="h-6 w-6" /> Laboratório</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Telas que saíram do menu para ele ficar só com o que se usa no dia a dia. Nada foi apagado: abrem daqui, pelo link ou pelas ações rápidas (⌘J, "Ir para"),
          e a estrela fixa no topo do menu. O uso é medido desde 15/10/2026; com 30 dias de dado decidimos o que volta e o que pode ser arquivado.
        </p>
      </header>

      <section className="space-y-2 rounded-lg border border-border bg-card p-4" aria-label="Fora do menu">
        <h2 className="text-lg font-semibold text-foreground">Fora do menu</h2>
        <ul className="divide-y divide-border">
          {LABORATORIO.map((i) => {
            const u = by.get(routeKey(i.url));
            const fav = favorites.includes(i.url);
            return (
              <li key={i.url} className="flex flex-wrap items-center gap-3 py-2 text-sm" aria-label={`Laboratório ${i.title}`}>
                <i.icon className="h-4 w-4 text-muted-foreground" />
                <Link to={i.url} className="font-medium text-foreground hover:text-primary hover:underline">{i.title}</Link>
                <span className="text-xs text-muted-foreground">{i.motivo}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{isLoading ? "…" : u ? `${u.visitas} visita(s) · ${u.pessoas} pessoa(s) · última ${fmt(u.ultima)}` : "sem uso em 30 dias"}</span>
                <button type="button" onClick={() => toggleFavorite(i.url)} title={fav ? "Tirar dos favoritos" : "Fixar no menu"} aria-label={fav ? `Tirar ${i.title} dos favoritos` : `Fixar ${i.title} no menu`}
                  className="text-muted-foreground hover:text-primary">
                  {fav ? <StarOff className="h-4 w-4 text-primary" /> : <Star className="h-4 w-4" />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-card p-4" aria-label="Uso das telas">
        <h2 className="text-lg font-semibold text-foreground">Uso das telas (30 dias)</h2>
        {medindoDesde && <p className="text-xs text-muted-foreground">A medição começou agora: a tabela enche conforme o time usa o sistema.</p>}
        {usage.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase text-muted-foreground"><tr><th className="py-1 pr-3 font-medium">Rota</th><th className="px-2 font-medium">Visitas</th><th className="px-2 font-medium">Pessoas</th><th className="px-2 font-medium">Última</th><th className="px-2 font-medium">No menu?</th></tr></thead>
            <tbody className="font-mono text-xs">
              {usage.slice(0, 40).map((u) => (
                <tr key={u.rota} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-sans text-foreground">{u.rota}</td>
                  <td className="px-2">{u.visitas}</td>
                  <td className="px-2">{u.pessoas}</td>
                  <td className="px-2">{fmt(u.ultima)}</td>
                  <td className="px-2">{menuUrls.has(u.rota) ? "sim" : "não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {usage.length > 0 && menuSemUso.length > 0 && (
          <p className="text-xs text-muted-foreground">No menu sem nenhuma visita ainda: {menuSemUso.map((i) => i.title).join(", ")}.</p>
        )}
      </section>
    </div>
  );
}
