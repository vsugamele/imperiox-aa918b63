import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Clock } from "lucide-react";

// Redirect mobile → /mobile-cockpit removido. App agora é responsivo no celular.
// Cockpit continua acessível manualmente via /mobile-cockpit.

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isPending, userStatus } = useAuth();
  

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-4 p-8">
          {userStatus === "rejected" ? (
            <>
              <Shield className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold text-foreground">Acesso Negado</h2>
              <p className="text-sm text-muted-foreground">
                Seu cadastro foi recusado pelo administrador. Entre em contato com o responsável para mais informações.
              </p>
            </>
          ) : (
            <>
              <Clock className="h-12 w-12 text-primary mx-auto animate-pulse" />
              <h2 className="text-xl font-bold text-foreground">Aguardando Aprovação</h2>
              <p className="text-sm text-muted-foreground">
                Seu cadastro está sendo analisado. Um administrador precisa aprovar seu acesso antes que você possa usar o sistema.
              </p>
            </>
          )}
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-primary underline hover:text-primary/80"
          >
            Verificar novamente
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
