#!/usr/bin/env node
/**
 * 🏛️ IMPÉRIO HQ — Worker Headless de Extração H&W Hub (Método B)
 * 
 * Este worker realiza a autenticação e extração automatizada de métricas
 * de afiliados da rede H&W Hub (hwaffiliate.com), consolidando em `imphq_metrics_daily`.
 * 
 * Uso:
 *   node scripts/scrapers/hw-hub-scraper.mjs [--project linfaflow] [--days 7] [--headless true]
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tkbivipqiewkfnhktmqq.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_QCQIcyLONPOaZgXL5P6Lew_QiesBf-1";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag, fallback) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
  };

  const projectId = getArg("--project", "linfaflow");
  const days = parseInt(getArg("--days", "7"), 10);
  const isHeadless = getArg("--headless", "true") === "true";
  const isDryRun = args.includes("--dry-run");

  console.log(`\n🔍 [H&W Hub Worker] Iniciando extração para projeto: ${projectId} (últimos ${days} dias)...`);

  // 1. Buscar credenciais no cofre
  const { data: vaultItems, error: vErr } = await supabase
    .from("imphq_tools_vault")
    .select("*")
    .or("portal_type.eq.hw_hub,url.ilike.%hwaffiliate%,name.ilike.%hw%")
    .limit(1);

  if (vErr) {
    console.error("❌ Erro ao buscar credenciais do cofre:", vErr.message);
    process.exit(1);
  }

  const credential = vaultItems?.[0];
  if (!credential) {
    console.warn("⚠️ Nenhuma credencial do H&W Hub encontrada no cofre (imphq_tools_vault).");
    console.log("👉 Cadastre a ferramenta 'H&W Hub' no Cofre com URL 'https://www.hwaffiliate.com' para habilitar a extração autônoma.");
    return;
  }

  console.log(`🔑 Credencial identificada: ${credential.name} (Usuário: ${credential.username || "—"})`);

  // 2. Tentar importar Playwright
  let chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    try {
      const pw = await import("playwright-core");
      chromium = pw.chromium;
    } catch {
      console.warn("\n⚠️ Playwright não está instalado neste ambiente local.");
      console.log("💡 Para rodar o browser autônomo localmente, execute:");
      console.log("   npm i -D playwright && npx playwright install chromium");
      console.log("\nSimulando estrutura de extração de dados...");
    }
  }

  let extractedRows = [];

  if (chromium && credential.username && credential.password_encrypted) {
    console.log(`🌐 Lançando navegador Chromium (Headless: ${isHeadless})...`);
    const browser = await chromium.launch({
      headless: isHeadless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 },
      });

      const page = await context.newPage();
      console.log("📄 Acessando https://www.hwaffiliate.com...");
      await page.goto("https://www.hwaffiliate.com/login", { waitUntil: "networkidle", timeout: 30000 });

      // Preenchimento de login
      const userSel = 'input[type="email"], input[name="email"], input[name="username"]';
      const passSel = 'input[type="password"]';

      if (await page.$(userSel)) {
        console.log("✍️ Preenchendo credenciais...");
        await page.fill(userSel, credential.username);
        await page.fill(passSel, credential.password_encrypted);
        await page.click('button[type="submit"], input[type="submit"]');
        await page.waitForNavigation({ timeout: 20000 }).catch(() => {});
      }

      console.log("📊 Navegando para relatórios de performance...");
      await page.goto("https://www.hwaffiliate.com/reports/performance", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});

      // Extração da tabela de relatórios
      extractedRows = await page.evaluate(() => {
        const rows = [];
        const trs = document.querySelectorAll("table tbody tr");
        trs.forEach(tr => {
          const tds = tr.querySelectorAll("td");
          if (tds.length >= 5) {
            rows.push({
              data_ref: tds[0]?.innerText?.trim(),
              produto_nome: tds[1]?.innerText?.trim(),
              cliques: parseInt(tds[2]?.innerText?.replace(/[^0-9]/g, "") || "0", 10),
              conversoes: parseInt(tds[3]?.innerText?.replace(/[^0-9]/g, "") || "0", 10),
              receita_liquida: parseFloat(tds[4]?.innerText?.replace(/[^0-9.]/g, "") || "0"),
            });
          }
        });
        return rows;
      });

      console.log(`✅ Extração concluída. ${extractedRows.length} registro(s) obtido(s).`);
    } catch (err) {
      console.error("❌ Erro durante o fluxo do navegador:", err.message);
    } finally {
      await browser.close();
    }
  }

  // 3. Gravar em imphq_metrics_daily
  if (extractedRows.length > 0 && !isDryRun) {
    console.log("💾 Gravando métricas em `imphq_metrics_daily`...");
    for (const row of extractedRows) {
      const cvr = row.cliques > 0 ? (row.conversoes / row.cliques) * 100 : 0;
      const epc = row.cliques > 0 ? row.receita_liquida / row.cliques : 0;

      await supabase.from("imphq_metrics_daily").upsert(
        {
          project_id: projectId,
          produto_nome: row.produto_nome || "LinfaFlow",
          data_ref: row.data_ref,
          source: "hw_hub",
          cliques: row.cliques,
          conversoes: row.conversoes,
          cvr: Number(cvr.toFixed(2)),
          receita_liquida: Number(row.receita_liquida.toFixed(2)),
          epc: Number(epc.toFixed(2)),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,source,data_ref" }
      );
    }

    // Atualiza status no cofre
    await supabase.from("imphq_tools_vault").update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: "success",
      last_sync_error: null,
    }).eq("id", credential.id);

    console.log("✨ Sincronização concluída com sucesso!");
  } else if (isDryRun) {
    console.log("ℹ️ Modo Dry-Run ativo: nenhuma alteração gravada.");
  }
}

main().catch(console.error);
