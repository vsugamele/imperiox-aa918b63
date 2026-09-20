import { errorMessage } from "@/lib/error-message";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      toast({ title: "Erro ao entrar", description: errorMessage(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "#0A0B0D" }}
    >
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#D6FF4B 1px, transparent 1px), linear-gradient(90deg, #D6FF4B 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto w-full max-w-[360px] px-6">
        {/* Brand */}
        <div className="mb-10 flex flex-col items-center gap-5 text-center">
          {/* Logo mark */}
          <div className="flex items-center justify-center" style={{ gap: 10 }}>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-md font-mono text-xl font-black"
              style={{
                background: "#D6FF4B",
                color: "#0A0B0D",
                letterSpacing: "-0.04em",
              }}
            >
              i
            </div>
            <span
              className="font-mono text-xl font-bold tracking-widest"
              style={{ color: "#E8EAED", letterSpacing: "0.18em" }}
            >
              IMPERIOHQ
            </span>
          </div>

          {/* Kicker */}
          <p
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "#5F646D" }}
          >
            · OPERAÇÃO ÚNICA ·
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-8"
          style={{
            background: "#0E1013",
            border: "1px solid #1B1E23",
          }}
        >
          {/* Card header */}
          <div className="mb-7">
            <p
              className="font-mono text-[10px] uppercase tracking-widest mb-1"
              style={{ color: "#5F646D" }}
            >
              Acesso restrito
            </p>
            <h1
              className="font-display text-2xl font-semibold"
              style={{ color: "#E8EAED" }}
            >
              Entrar na plataforma
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="font-mono text-[11px] uppercase tracking-wider"
                style={{ color: "#8A8F98" }}
              >
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className="h-11 font-mono text-sm placeholder:text-[#3A3F48]"
                style={{
                  background: "#14161A",
                  border: "1px solid #23262C",
                  color: "#E8EAED",
                }}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="font-mono text-[11px] uppercase tracking-wider"
                style={{ color: "#8A8F98" }}
              >
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="h-11 font-mono text-sm placeholder:text-[#3A3F48]"
                style={{
                  background: "#14161A",
                  border: "1px solid #23262C",
                  color: "#E8EAED",
                }}
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-11 w-full font-mono text-sm font-bold tracking-widest uppercase transition-all"
              style={{
                background: isLoading ? "#A8CC2D" : "#D6FF4B",
                color: "#0A0B0D",
                border: "none",
              }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </span>
              ) : (
                "Entrar →"
              )}
            </Button>
          </form>
        </div>

        {/* Footer note */}
        <p
          className="mt-6 text-center font-mono text-[10px] tracking-wider"
          style={{ color: "#3A3F48" }}
        >
          Acesso exclusivo para operadores autorizados
        </p>
      </div>
    </div>
  );
}
