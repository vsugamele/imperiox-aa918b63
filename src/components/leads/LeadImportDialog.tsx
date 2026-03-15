import { useState, useCallback } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileUp, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: { id: string; name: string; icon?: string }[];
  defaultProjectId?: string;
  onComplete: () => void;
}

type Platform = "ticto" | "hotmart" | "kiwify" | "auto";

const STATUS_MAP_TICTO: Record<string, string> = {
  Autorizado: "compra_aprovada",
  Aprovado: "compra_aprovada",
  Reembolsado: "reembolso",
  "Carrinho Abandonado": "carrinho_abandonado",
  Cancelado: "cancelado",
  Aguardando: "aguardando_pagamento",
  "Aguardando Pagamento": "aguardando_pagamento",
  Recusado: "recusado",
};

const STATUS_MAP_HOTMART: Record<string, string> = {
  APPROVED: "compra_aprovada",
  COMPLETE: "compra_aprovada",
  REFUNDED: "reembolso",
  CANCELLED: "cancelado",
  WAITING_PAYMENT: "aguardando_pagamento",
};

const STATUS_MAP_KIWIFY: Record<string, string> = {
  paid: "compra_aprovada",
  approved: "compra_aprovada",
  refunded: "reembolso",
  waiting_payment: "aguardando_pagamento",
};

interface MappedRow {
  nome: string;
  email: string;
  phone: string;
  status_evento: string;
  valor: number;
  produto: string;
  utms: Record<string, string>;
  raw: Record<string, string>;
}

function detectPlatform(headers: string[]): Platform {
  const joined = headers.join(",").toLowerCase();
  if (joined.includes("código do pedido") || joined.includes("nome da oferta") || joined.includes("código da oferta"))
    return "ticto";
  if (joined.includes("transaction") && joined.includes("hottok"))
    return "hotmart";
  if (joined.includes("order_id") || joined.includes("webhook_event_type"))
    return "kiwify";
  // Fallback: check for Ticto column patterns
  if (joined.includes("nome do cliente") || joined.includes("e-mail do cliente"))
    return "ticto";
  return "auto";
}

function findCol(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    const key = Object.keys(row).find(k => k.toLowerCase().trim() === c.toLowerCase().trim());
    if (key && row[key]) return row[key].trim();
  }
  return "";
}

function mapRow(row: Record<string, string>, platform: Platform): MappedRow {
  if (platform === "ticto" || platform === "auto") {
    const statusRaw = findCol(row, "Status");
    return {
      nome: findCol(row, "Nome do Cliente"),
      email: findCol(row, "E-mail do Cliente"),
      phone: findCol(row, "Telefone Completo do Cliente", "Telefone Completo"),
      status_evento: STATUS_MAP_TICTO[statusRaw] || statusRaw.toLowerCase(),
      valor: parseFloat((findCol(row, "Valor Pago") || "0").replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
      produto: findCol(row, "Nome do Produto"),
      utms: {
        utm_source: findCol(row, "Fonte de Tráfego", "Fonte de Trafego"),
        utm_campaign: findCol(row, "Campanha"),
        utm_medium: findCol(row, "Plataforma de Anúncio", "Plataforma de Anuncio"),
        utm_content: findCol(row, "Anúncio", "Anuncio"),
        utm_term: findCol(row, "Conjunto de Anúncios", "Conjunto de Anuncios"),
      },
      raw: row,
    };
  }
  if (platform === "hotmart") {
    const statusRaw = findCol(row, "Status", "status");
    return {
      nome: findCol(row, "buyer_name", "Nome"),
      email: findCol(row, "buyer_email", "Email"),
      phone: findCol(row, "buyer_phone", "Telefone"),
      status_evento: STATUS_MAP_HOTMART[statusRaw] || statusRaw.toLowerCase(),
      valor: parseFloat((findCol(row, "price", "Valor") || "0").replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
      produto: findCol(row, "product_name", "Produto"),
      utms: {
        utm_source: findCol(row, "src", "utm_source"),
        utm_campaign: findCol(row, "utm_campaign"),
        utm_medium: findCol(row, "utm_medium"),
      },
      raw: row,
    };
  }
  // kiwify
  const statusRaw = findCol(row, "order_status", "Status");
  return {
    nome: findCol(row, "customer_name", "Nome"),
    email: findCol(row, "customer_email", "Email"),
    phone: findCol(row, "customer_mobile", "Telefone"),
    status_evento: STATUS_MAP_KIWIFY[statusRaw] || statusRaw.toLowerCase(),
    valor: parseFloat((findCol(row, "sale_amount", "Valor") || "0").replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
    produto: findCol(row, "product_name", "Produto"),
    utms: {
      utm_source: findCol(row, "utm_source"),
      utm_campaign: findCol(row, "utm_campaign"),
    },
    raw: row,
  };
}

export function LeadImportDialog({ open, onOpenChange, projects, defaultProjectId, onComplete }: Props) {
  const [platform, setPlatform] = useState<Platform>("auto");
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const [rows, setRows] = useState<MappedRow[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>("auto");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; updated: number; sales: number } | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        const headers = results.meta.fields || [];
        setRawHeaders(headers);
        const detected = detectPlatform(headers);
        setDetectedPlatform(detected);
        const usePlatform = platform === "auto" ? detected : platform;

        const mapped = (results.data as Record<string, string>[])
          .map(r => mapRow(r, usePlatform))
          .filter(r => r.email);

        setRows(mapped);
      },
    });
  }, [platform]);

  const runImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    setProgress(0);
    let created = 0, updated = 0, sales = 0;
    const pid = projectId || null;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const emailLc = r.email.toLowerCase();

      // Check existing
      const { data: existing } = await supabase
        .from("imphq_leads")
        .select("id, data")
        .eq("email", emailLc)
        .limit(1)
        .maybeSingle();

      let leadId: string;

      if (existing) {
        leadId = existing.id;
        // Merge data
        const existingData = (existing.data as any) || {};
        const mergedData = {
          ...existingData,
          ultimo_evento: r.status_evento,
          utms: { ...(existingData.utms || {}), ...Object.fromEntries(Object.entries(r.utms).filter(([, v]) => v)) },
          importado_em: new Date().toISOString(),
        };
        await supabase.from("imphq_leads").update({
          data: mergedData as any,
          status: r.status_evento === "compra_aprovada" ? "cliente" : undefined,
          project_id: pid || undefined,
        } as any).eq("id", leadId);
        updated++;
      } else {
        leadId = crypto.randomUUID();
        const utmsClean = Object.fromEntries(Object.entries(r.utms).filter(([, v]) => v));
        await supabase.from("imphq_leads").insert({
          id: leadId,
          nome: r.nome || emailLc,
          email: emailLc,
          phone: r.phone || null,
          plataforma: detectedPlatform === "auto" ? "Importação" : detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1),
          status: r.status_evento === "compra_aprovada" ? "cliente" : "lead",
          project_id: pid,
          data: {
            ultimo_evento: r.status_evento,
            utms: utmsClean,
            importado_em: new Date().toISOString(),
          } as any,
        });
        created++;
      }

      // Create sale if purchase
      if (r.status_evento === "compra_aprovada" && r.valor > 0) {
        await supabase.from("imphq_vendas").insert({
          id: crypto.randomUUID(),
          lead_id: leadId,
          project_id: pid,
          produto: r.produto,
          valor: r.valor,
          plataforma: detectedPlatform === "auto" ? "Importação" : detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1),
          status: "aprovado",
        });
        sales++;
      }

      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setImporting(false);
    setResult({ created, updated, sales });
    toast.success(`Importação concluída: ${created} criados, ${updated} atualizados, ${sales} vendas`);
    onComplete();
  };

  const reset = () => {
    setRows([]); setRawHeaders([]); setResult(null); setProgress(0);
  };

  const effectivePlatform = platform === "auto" ? detectedPlatform : platform;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" /> Importar Leads via CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Config */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plataforma</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🔍 Detectar Automaticamente</SelectItem>
                  <SelectItem value="ticto">Ticto</SelectItem>
                  <SelectItem value="hotmart">Hotmart</SelectItem>
                  <SelectItem value="kiwify">Kiwify</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto Destino</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Selecionar projeto..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem projeto</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Upload */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload" className="cursor-pointer space-y-2 block">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Clique para selecionar um arquivo CSV</p>
              <p className="text-[10px] text-muted-foreground">Suporta exports da Ticto, Hotmart e Kiwify</p>
            </label>
          </div>

          {/* Detected info */}
          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  Plataforma: {effectivePlatform === "auto" ? "Genérico" : effectivePlatform.charAt(0).toUpperCase() + effectivePlatform.slice(1)}
                </Badge>
                <Badge variant="outline" className="text-xs">{rows.length} registros</Badge>
                <Badge variant="outline" className="text-xs">
                  {rows.filter(r => r.status_evento === "compra_aprovada").length} vendas
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {rawHeaders.length} colunas
                </Badge>
              </div>

              {/* Preview */}
              <div className="rounded-lg border border-border overflow-auto max-h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Estágio</TableHead>
                      <TableHead className="text-xs">Valor</TableHead>
                      <TableHead className="text-xs">Produto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 5).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.nome || "—"}</TableCell>
                        <TableCell className="text-xs">{r.email}</TableCell>
                        <TableCell>
                          <Badge className="text-[9px]" variant={r.status_evento === "compra_aprovada" ? "default" : "secondary"}>
                            {r.status_evento}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {r.valor > 0 ? `R$ ${r.valor.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[120px]">{r.produto || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 5 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Mostrando 5 de {rows.length} registros
                </p>
              )}
            </>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">Importando... {progress}%</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-400">Importação concluída!</p>
                <p className="text-xs text-muted-foreground">
                  {result.created} criados · {result.updated} atualizados · {result.sales} vendas registradas
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!result ? (
            <Button onClick={runImport} disabled={rows.length === 0 || importing}>
              <FileUp className="h-4 w-4 mr-1" />
              Importar {rows.length > 0 ? `${rows.length} leads` : ""}
            </Button>
          ) : (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
