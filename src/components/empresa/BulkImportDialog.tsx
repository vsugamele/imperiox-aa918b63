import { useState, useMemo } from "react";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Array<{ id: string; name: string }>;
  devices: Array<{ id: string; nome: string; provider: string }>;
  onSuccess: () => void;
}

interface ParsedAccount {
  nome: string;
  senha?: string;
  recoveryEmail?: string;
  totpSecret?: string;
  proxyEndpoint?: string;
  proxyUser?: string;
  proxyPass?: string;
}

export function BulkImportDialog({ open, onOpenChange, projects, devices, onSuccess }: Props) {
  const [tipo, setTipo] = useState<string>("instagram");
  const [status, setStatus] = useState<string>("Aquecendo");
  const [projectId, setProjectId] = useState<string>("none");
  const [deviceId, setDeviceId] = useState<string>("none");
  const [defaultProxy, setDefaultProxy] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parser em tempo real das linhas coladas
  const parsedAccounts = useMemo<ParsedAccount[]>(() => {
    if (!rawText.trim()) return [];

    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: ParsedAccount[] = [];

    for (const line of lines) {
      // Divide por :, ;, |, vírgula ou tabulação
      const parts = line.split(/[:;|,\t]+/).map((p) => p.trim());
      if (parts.length === 0 || !parts[0]) continue;

      const acc: ParsedAccount = {
        nome: parts[0],
      };

      if (parts.length >= 2) {
        acc.senha = parts[1];
      }

      // Heurística de colunas adicionais comuns de fornecedores:
      // usuario:senha:email:senha_email
      // email:senha:recuperacao:2fa
      // usuario:senha:ip:porta:user:pass
      if (parts.length >= 3) {
        const p2 = parts[2];
        if (p2.includes("@")) {
          acc.recoveryEmail = p2;
        } else if (p2.includes(".") && !isNaN(Number(parts[3]))) {
          // IP:Porta
          acc.proxyEndpoint = `${p2}:${parts[3]}`;
          if (parts[4]) acc.proxyUser = parts[4];
          if (parts[5]) acc.proxyPass = parts[5];
        } else if (p2.length >= 16 && !p2.includes(" ")) {
          // Provável chave 2FA TOTP (base32)
          acc.totpSecret = p2;
        }
      }

      if (parts.length >= 4 && !acc.proxyEndpoint) {
        const p3 = parts[3];
        if (p3.length >= 16 && !p3.includes(" ")) {
          acc.totpSecret = p3;
        }
      }

      parsed.push(acc);
    }

    return parsed;
  }, [rawText]);

  const handleImport = async () => {
    if (parsedAccounts.length === 0) {
      toast.error("Nenhuma conta válida identificada no texto.");
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedDevice = devices.find((d) => d.id === deviceId);

      const rowsToInsert = parsedAccounts.map((acc, index) => {
        const extraData: Record<string, unknown> = {
          status_aquecimento: status,
        };

        if (acc.senha) extraData.senha = acc.senha;
        if (acc.recoveryEmail) extraData.telefone = acc.recoveryEmail; // ou recovery
        if (acc.totpSecret) extraData.totp_secret = acc.totpSecret;
        if (acc.proxyUser) extraData.proxy_user = acc.proxyUser;
        if (acc.proxyPass) extraData.proxy_pass = acc.proxyPass;

        const proxy = acc.proxyEndpoint || defaultProxy.trim() || null;

        return {
          nome: acc.nome,
          tipo,
          warmup_status: status,
          warmup_days: status === "Pronto" ? 30 : 0,
          project_id: projectId !== "none" ? projectId : null,
          cloud_phone_ref: deviceId !== "none" ? deviceId : null,
          cloud_phone_provider: selectedDevice?.provider || null,
          proxy_endpoint: proxy,
          extra: extraData as Json,
          position: index,
        };
      });

      const { error } = await supabase.from("imphq_empresa").insert(rowsToInsert);
      if (error) throw error;

      toast.success(`${rowsToInsert.length} contas importadas com sucesso!`);
      setRawText("");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(`Erro ao importar contas: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importação em Lote de Ativos & Contas
          </DialogTitle>
          <DialogDescription>
            Cole o lote fornecido pelo revendedor (formato <code className="font-mono text-xs">user:senha</code> ou <code className="font-mono text-xs">email:senha:2fa</code>). O sistema cria todos os ativos em 1 clique.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Seletor de Tipo e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de Ativo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="email">Email (Gmail / Outlook)</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="farm">Farm Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status Inicial</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aquecendo">Aquecendo (Em maturação)</SelectItem>
                  <SelectItem value="Pronto">Pronto (Pronto para tráfego)</SelectItem>
                  <SelectItem value="Inativo">Inativo (Em estoque)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vínculo opcional de Projeto e Device */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vincular a Projeto (Opcional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (Geral)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (Disponível)</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Atribuir a Cloud Phone / Device (Opcional)</Label>
              <Select value={deviceId} onValueChange={setDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (Sem device)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {devices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome} ({d.provider})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Proxy padrão opcional */}
          <div className="space-y-1.5">
            <Label htmlFor="default-proxy">Proxy padrão para o lote (Opcional)</Label>
            <Input
              id="default-proxy"
              placeholder="ex: 192.168.1.1:8080 ou socks5://user:pass@host:port"
              value={defaultProxy}
              onChange={(e) => setDefaultProxy(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          {/* Área de Colagem */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="raw-accounts">Lista de Contas (Uma por linha)</Label>
              {parsedAccounts.length > 0 && (
                <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  {parsedAccounts.length} conta(s) detectada(s)
                </Badge>
              )}
            </div>
            <Textarea
              id="raw-accounts"
              placeholder={`perfil_insta1:SenhaForte123\nperfil_insta2:SenhaForte123:recuperacao@email.com:CHAVE2FATOTP\ncontanova@gmail.com:SenhaGmail:email_rec@gmail.com`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Separadores suportados: dois pontos (<code className="text-foreground">:</code>), ponto e vírgula (<code className="text-foreground">;</code>), barra (<code className="text-foreground">|</code>) ou tabulação.
            </p>
          </div>

          {/* Preview dos primeiros itens */}
          {parsedAccounts.length > 0 && (
            <div className="space-y-1.5 border rounded-md p-2 bg-muted/30">
              <div className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground px-1">
                <span>Prévia das primeiras contas:</span>
              </div>
              <div className="max-h-36 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-7 text-xs">Identificador / Nome</TableHead>
                      <TableHead className="h-7 text-xs">Senha</TableHead>
                      <TableHead className="h-7 text-xs">Recuperação / 2FA</TableHead>
                      <TableHead className="h-7 text-xs">Proxy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedAccounts.slice(0, 5).map((acc, i) => (
                      <TableRow key={i} className="h-7 text-xs font-mono">
                        <TableCell className="py-1">{acc.nome}</TableCell>
                        <TableCell className="py-1 text-muted-foreground">
                          {acc.senha ? "••••••••" : <span className="text-muted-foreground/50">sem senha</span>}
                        </TableCell>
                        <TableCell className="py-1 text-muted-foreground">
                          {acc.totpSecret ? "Chave 2FA" : acc.recoveryEmail || "—"}
                        </TableCell>
                        <TableCell className="py-1 text-muted-foreground">
                          {acc.proxyEndpoint || (defaultProxy ? "Padrão" : "—")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedAccounts.length > 5 && (
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  + {parsedAccounts.length - 5} outras contas serão criadas.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={isSubmitting || parsedAccounts.length === 0}
            className="gap-1.5 bg-primary text-primary-foreground"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {parsedAccounts.length > 0 ? `${parsedAccounts.length} Contas` : "Contas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
