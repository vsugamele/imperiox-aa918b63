import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const CHUNK_RE =
  /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk \d+ failed|ChunkLoadError/i;

async function hardReload() {
  try {
    if (typeof caches !== "undefined" && caches?.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((regs || []).map((r) => r.unregister().catch(() => {})));
  } catch {
    /* best effort */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now()));
  window.location.replace(url.toString());
}

interface State {
  error: Error | null;
}

/**
 * Catches lazy-route load failures (stale hashed chunks after a deploy) so the
 * app shows a recovery screen instead of a blank page.
 */
export class ChunkErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[route-error]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isChunk = CHUNK_RE.test(error.message || "");

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-5 text-center">
          <h1
            className="text-4xl font-light text-primary"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            {isChunk ? "Versão desatualizada" : "Algo deu errado"}
          </h1>
          <p className="text-sm leading-7 text-foreground/80">
            {isChunk
              ? "Seu navegador está usando uma versão antiga do app. Recarregue para carregar a versão nova."
              : error.message}
          </p>
          <Button onClick={hardReload} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Limpar cache e recarregar
          </Button>
        </div>
      </div>
    );
  }
}
