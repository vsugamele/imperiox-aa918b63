import { NavLink } from "react-router-dom";
import { Pencil, Mail, Radio } from "lucide-react";

const tabs = [
  { to: "/rascunhos", label: "Rascunhos IA", icon: Pencil },
  { to: "/nutricao",  label: "Nutrição",    icon: Mail },
  { to: "/webinar",   label: "Webinar",     icon: Radio },
];

/**
 * Switcher visual de "Conteúdo" — agrupa Rascunhos IA, Nutrição e Webinar
 * em uma faixa de abas no topo de cada página, sem alterar a sidebar.
 */
export function ConteudoTabs() {
  return (
    <div className="flex items-center gap-1 border-b border-border/40 pb-2 -mt-2 mb-2 overflow-x-auto">
      <span className="text-[9px] uppercase tracking-[0.28em] text-gold/70 px-2 shrink-0">
        Conteúdo
      </span>
      <span className="text-muted-foreground/40 px-1">·</span>
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors whitespace-nowrap ${
              isActive
                ? "bg-secondary/60 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
            }`
          }
        >
          <t.icon className="h-3.5 w-3.5" />
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
