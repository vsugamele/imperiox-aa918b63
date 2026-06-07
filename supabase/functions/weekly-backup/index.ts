import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function arrayToCsv(data: any[]): string {
  if (!data || data.length === 0) return "Sem dados";
  
  // Extract all unique keys as headers
  const headers = Array.from(
    new Set(data.flatMap(item => Object.keys(item || {})))
  );
  
  const csvRows = [];
  csvRows.push(headers.join(","));

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      
      let str = typeof val === "object" ? JSON.stringify(val) : String(val);
      // Clean and escape quotes for CSV
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    });
    csvRows.push(values.join(","));
  }
  return csvRows.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log("[weekly-backup] Starting backup process...");

    // 1. Create backups bucket if not exists
    await supabase.storage.createBucket("backups", { public: false }).catch(() => {
      console.log("[weekly-backup] Bucket 'backups' already exists or could not be created.");
    });

    // 2. Load all projects
    const { data: projects, error: projErr } = await supabase
      .from("imphq_projects")
      .select("id, name");

    if (projErr) throw projErr;
    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "Nenhum projeto para backup." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const backupResults: any[] = [];
    const dateStr = new Date().toISOString().split("T")[0];

    for (const project of projects) {
      console.log(`[weekly-backup] Exporting data for project: ${project.name} (${project.id})...`);

      // Fetch leads
      const { data: leads } = await supabase
        .from("imphq_leads")
        .select("*")
        .eq("project_id", project.id)
        .limit(5000);

      // Fetch sales
      const { data: sales } = await supabase
        .from("imphq_vendas")
        .select("*")
        .eq("project_id", project.id)
        .limit(5000);

      // Fetch ads spend
      const { data: adsSpend } = await supabase
        .from("imphq_ads_spend")
        .select("*")
        .eq("projeto_id", project.id) // note: matches schema column
        .limit(5000);

      // Convert to CSV
      const leadsCsv = arrayToCsv(leads || []);
      const salesCsv = arrayToCsv(sales || []);
      const adsCsv = arrayToCsv(adsSpend || []);

      // Store in storage bucket
      const leadsPath = `${project.id}/${dateStr}_leads.csv`;
      const salesPath = `${project.id}/${dateStr}_vendas.csv`;
      const adsPath = `${project.id}/${dateStr}_ads_spend.csv`;

      await supabase.storage.from("backups").upload(leadsPath, leadsCsv, { contentType: "text/csv", upsert: true });
      await supabase.storage.from("backups").upload(salesPath, salesCsv, { contentType: "text/csv", upsert: true });
      await supabase.storage.from("backups").upload(adsPath, adsCsv, { contentType: "text/csv", upsert: true });

      // Generate signed URLs (expire in 7 days)
      const { data: leadsUrl } = await supabase.storage.from("backups").createSignedUrl(leadsPath, 60 * 60 * 24 * 7);
      const { data: salesUrl } = await supabase.storage.from("backups").createSignedUrl(salesPath, 60 * 60 * 24 * 7);
      const { data: adsUrl } = await supabase.storage.from("backups").createSignedUrl(adsPath, 60 * 60 * 24 * 7);

      // Get Resend config for this project
      let resendKey = RESEND_API_KEY || "";
      let fromEmail = "backup@imperiox.lovable.app";
      let toEmail = "admin@imperiox.lovable.app";

      const { data: creds } = await supabase
        .from("imphq_integration_credentials")
        .select("credentials")
        .eq("project_id", project.id)
        .eq("provider", "resend")
        .maybeSingle();

      if (creds?.credentials) {
        resendKey = creds.credentials.api_key || resendKey;
        fromEmail = creds.credentials.from_email || fromEmail;
        toEmail = creds.credentials.reply_to || toEmail; // send back to admin/reply_to
      }

      // If resend API Key is available, send email
      if (resendKey) {
        try {
          const emailSubject = `Imperio HQ - Backup Semanal: ${project.name}`;
          const emailHtml = `
            <div style="font-family: sans-serif; background-color: #0b0f19; color: #f1f5f9; padding: 25px; border-radius: 12px; border: 1px solid #1e293b;">
              <h2 style="color: #f59e0b; margin-bottom: 5px;">Imperio HQ</h2>
              <h3 style="color: #ffffff; margin-top: 0;">Backup Semanal Concluído</h3>
              <p>Os dados do seu projeto <strong>${project.name}</strong> foram exportados para CSV com sucesso!</p>
              <p>Clique nos links abaixo para baixar os relatórios correspondentes (válidos por 7 dias):</p>
              
              <ul style="padding-left: 20px; line-height: 1.8;">
                <li>📥 <a href="${leadsUrl?.signedUrl}" style="color: #f59e0b; text-decoration: underline;">Exportação de Leads (${leads?.length || 0} registros)</a></li>
                <li>📥 <a href="${salesUrl?.signedUrl}" style="color: #f59e0b; text-decoration: underline;">Exportação de Vendas (${sales?.length || 0} registros)</a></li>
                <li>📥 <a href="${adsUrl?.signedUrl}" style="color: #f59e0b; text-decoration: underline;">Exportação de Gastos com Anúncios (${adsSpend?.length || 0} registros)</a></li>
              </ul>
              
              <p style="font-size: 11px; color: #94a3b8; margin-top: 30px; border-t: 1px solid #1e293b; pt: 10px;">
                Este é um e-mail automático enviado pelo sistema Imperio HQ. Por favor, guarde esses links em local seguro.
              </p>
            </div>
          `;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `Imperio HQ <${fromEmail}>`,
              to: [toEmail],
              subject: emailSubject,
              html: emailHtml,
            }),
          });
          console.log(`[weekly-backup] Email sent to ${toEmail} for project ${project.name}`);
        } catch (mailErr: any) {
          console.error(`[weekly-backup] Failed to send email for project ${project.name}:`, mailErr.message);
        }
      }

      backupResults.push({
        project_id: project.id,
        project_name: project.name,
        leads_count: leads?.length || 0,
        sales_count: sales?.length || 0,
        ads_count: adsSpend?.length || 0,
      });
    }

    return new Response(JSON.stringify({ ok: true, results: backupResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[weekly-backup] Fatal:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
