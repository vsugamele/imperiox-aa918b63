import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Home } from "lucide-react";

const KNOWN_ROUTES = [
  "/dashboard","/projetos","/kanban","/tarefas","/chat",
  "/leads","/financas","/gerenciador","/market-intel","/funis","/metas","/nutricao","/recuperacao","/cohort",
  "/mentes","/conteudo-ia","/criativos","/openflow",
  "/docs","/whatsapp","/tracker","/referencias","/skills","/cofre",
  "/equipe","/empresa","/configuracoes","/guia",
];

const NotFound = () => {
  const location = useLocation();
  const [busting, setBusting] = useState(false);

  const path = location.pathname;
  const looksKnown = KNOWN_ROUTES.some((r) => path === r || path.startsWith(r + "/"));

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", path);
  }, [path]);

  const hardReload = async () => {
    setBusting(true);
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((regs || []).map((r) => r.unregister().catch(() => {})));
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
      }
    } catch (_) {}
    // Cache-bust the document.
    const url = new URL(window.location.href);
    url.searchParams.set("_v", String(Date.now()));
    window.location.replace(url.toString());
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-5">
        <h1 className="text-5xl font-light text-primary" style={{ fontFamily: "Cormorant Garamond, serif" }}>404</h1>
        <p className="text-lg text-foreground/80">Rota não encontrada: <code className="text-primary/80">{path}</code></p>

        {looksKnown && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground/80 leading-7 text-left">
            Essa rota <strong>existe</strong> na versão atual do app. Provavelmente seu navegador está
            servindo um bundle antigo via cache/Service Worker. Use o botão abaixo para limpar e recarregar.
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <Button onClick={hardReload} disabled={busting} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${busting ? "animate-spin" : ""}`} />
            Limpar cache e recarregar
          </Button>
          <Button variant="outline" asChild>
            <a href="/" className="gap-2 inline-flex items-center"><Home className="h-4 w-4" /> Início</a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
