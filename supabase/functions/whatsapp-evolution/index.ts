import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const DEFAULT_EVOLUTION_URL = (
  Deno.env.get("EVOLUTION_API_URL") ||
  "https://darkadvanced-evolution-api.llxtug.easypanel.host"
).replace(/\/+$/, "");

const DEFAULT_EVOLUTION_KEY =
  Deno.env.get("EVOLUTION_GLOBAL_KEY") ||
  Deno.env.get("EVOLUTION_API_KEY") ||
  "429683C4C977415CAAFCCE10F7D57E11";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeInstanceName(
  rawName?: string | null,
  providerId?: string | null,
  projectId?: string | null
): string {
  let name = (rawName || "").trim();
  if (!name) {
    if (providerId) {
      name = `imp_${providerId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}`;
    } else if (projectId) {
      name = `imp_${projectId.replace(/[^a-zA-Z0-9]/g, "")}`;
    } else {
      name = `imp_${Date.now()}`;
    }
  }
  name = name.replace(/[^a-zA-Z0-9_-]/g, "");
  // Se não foi passado nome explícito e não tem prefixo, adiciona imp_
  if (!rawName && !name.startsWith("imp_") && !name.startsWith("afiliado_")) {
    name = `imp_${name}`;
  }
  return name;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action");

    let body: Record<string, any> = {};
    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch (_) {
        body = {};
      }
    }

    if (!action && body.action) {
      action = body.action;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const providerId = body.provider_id || url.searchParams.get("provider_id") || null;
    const projectId = body.project_id || url.searchParams.get("project_id") || null;
    const displayName = body.display_name || url.searchParams.get("display_name") || null;
    let rawInstance = body.instance || body.instance_name || url.searchParams.get("instance") || url.searchParams.get("instance_name") || null;

    // Se temos provider_id e não recebemos instance, busca no banco
    if (providerId && !rawInstance) {
      const { data: prov } = await supabase
        .from("imphq_wa_providers")
        .select("instance_name, project_id, display_name")
        .eq("id", providerId)
        .maybeSingle();

      if (prov?.instance_name) {
        rawInstance = prov.instance_name;
      }
    }

    const instanceName = normalizeInstanceName(rawInstance, providerId, projectId);
    const evolutionUrl = DEFAULT_EVOLUTION_URL;
    const evolutionKey = DEFAULT_EVOLUTION_KEY;

    // ── 1. GERAR QRCODE ──
    if (action === "gerar_qrcode" || action === "qr_code") {
      console.log(`[whatsapp-evolution] gerar_qrcode instance=${instanceName}`);

      // 1.1 Verificar se instância existe
      let instanceExists = false;
      try {
        const fetchRes = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
          headers: { apikey: evolutionKey },
        });
        if (fetchRes.ok) {
          const list = await fetchRes.json();
          if (Array.isArray(list)) {
            instanceExists = list.some(
              (i: any) => i.name?.toLowerCase() === instanceName.toLowerCase()
            );
          }
        }
      } catch (err) {
        console.warn("[whatsapp-evolution] Erro ao buscar instâncias:", err);
      }

      // 1.2 Criar se não existir
      if (!instanceExists) {
        console.log(`[whatsapp-evolution] Criando nova instância: ${instanceName}`);
        const createRes = await fetch(`${evolutionUrl}/instance/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionKey,
          },
          body: JSON.stringify({
            instanceName,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
          }),
        });

        if (!createRes.ok) {
          const errText = await createRes.text();
          console.error(`[whatsapp-evolution] Falha ao criar instância (${createRes.status}):`, errText);
        } else {
          // Pequena pausa para inicialização do socket Baileys
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      // 1.3 Configurar Webhook no Evolution
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-api?action=webhook&provider=evolution`;
      try {
        const webhookRes = await fetch(`${evolutionUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: evolutionKey,
          },
          body: JSON.stringify({
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            webhookBase64: false,
            events: [
              "CONNECTION_UPDATE",
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE",
              "SEND_MESSAGE",
            ],
          }),
        });
        console.log(`[whatsapp-evolution] Webhook set status=${webhookRes.status} url=${webhookUrl}`);
      } catch (wErr) {
        console.warn("[whatsapp-evolution] Erro ao configurar webhook:", wErr);
      }

      // 1.4 Chamar GET /instance/connect/{instance} para obter QR Code
      const connectRes = await fetch(`${evolutionUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
        headers: { apikey: evolutionKey },
      });
      const connectData = await connectRes.json().catch(() => ({}));

      let qrcode = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.code || null;
      if (qrcode && typeof qrcode === "string" && !qrcode.startsWith("data:")) {
        qrcode = `data:image/png;base64,${qrcode}`;
      }

      // 1.5 Atualizar / Inserir registro em imphq_wa_providers
      let finalProviderId = providerId;
      if (providerId) {
        await supabase
          .from("imphq_wa_providers")
          .update({
            instance_name: instanceName,
            api_url: evolutionUrl,
            api_key: evolutionKey,
            provider: "evolution",
            status: "connecting",
            status_updated_at: new Date().toISOString(),
          })
          .eq("id", providerId);
      } else {
        // Verifica se já existe por instance_name
        const { data: existing } = await supabase
          .from("imphq_wa_providers")
          .select("id")
          .eq("instance_name", instanceName)
          .maybeSingle();

        if (existing) {
          finalProviderId = existing.id;
          await supabase
            .from("imphq_wa_providers")
            .update({
              api_url: evolutionUrl,
              api_key: evolutionKey,
              provider: "evolution",
              status: "connecting",
              status_updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          // Criar novo provider
          const { data: inserted, error: insErr } = await supabase
            .from("imphq_wa_providers")
            .insert({
              project_id: projectId || "default",
              provider: "evolution",
              instance_name: instanceName,
              display_name: displayName || instanceName,
              api_url: evolutionUrl,
              api_key: evolutionKey,
              status: "connecting",
              is_active: false,
            })
            .select("id")
            .single();

          if (!insErr && inserted) {
            finalProviderId = inserted.id;
          }
        }
      }

      return jsonResponse({
        success: true,
        instance: instanceName,
        qrcode,
        status: "connecting",
        provider_id: finalProviderId,
      });
    }

    // ── 2. CHECAR STATUS ──
    if (action === "checar_status" || action === "status") {
      // 2.1 Consulta connectionState
      const stateRes = await fetch(`${evolutionUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
        headers: { apikey: evolutionKey },
      });
      const stateData = await stateRes.json().catch(() => ({}));
      const state = stateData?.instance?.state || stateData?.state || "unknown";

      console.log(`[whatsapp-evolution] checar_status instance=${instanceName} state=${state}`);

      if (state === "open") {
        // 2.2 Se open, busca os dados da conexão (número conectado e perfil)
        let phone: string | null = null;
        let profileName: string | null = null;

        try {
          const fetchRes = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
            headers: { apikey: evolutionKey },
          });
          if (fetchRes.ok) {
            const list = await fetchRes.json();
            if (Array.isArray(list)) {
              const inst = list.find(
                (i: any) => i.name?.toLowerCase() === instanceName.toLowerCase()
              );
              if (inst) {
                const ownerJid = inst.ownerJid || inst.owner || "";
                phone = ownerJid
                  ? ownerJid.split("@")[0].replace(/\D/g, "")
                  : (inst.number ? String(inst.number).replace(/\D/g, "") : null);
                profileName = inst.profileName || null;
              }
            }
          }
        } catch (fErr) {
          console.warn("[whatsapp-evolution] Erro ao buscar dados da instância conectada:", fErr);
        }

        // Atualizar status no banco
        const patch: Record<string, any> = {
          status: "connected",
          is_active: true,
          status_updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        };
        if (phone) patch.twilio_from = phone;
        if (profileName) patch.display_name = profileName;

        await supabase
          .from("imphq_wa_providers")
          .update(patch)
          .eq("instance_name", instanceName);

        return jsonResponse({
          success: true,
          status: "open",
          state: "open",
          connected: true,
          phone,
          profileName,
          instance: instanceName,
        });
      }

      // Se close ou outro status
      if (state === "close") {
        await supabase
          .from("imphq_wa_providers")
          .update({
            status: "disconnected",
            is_active: false,
            status_updated_at: new Date().toISOString(),
          })
          .eq("instance_name", instanceName);
      }

      return jsonResponse({
        success: true,
        status: state,
        state,
        connected: false,
        instance: instanceName,
      });
    }

    // ── 3. DESCONECTAR ──
    if (action === "desconectar" || action === "logout" || action === "disconnect") {
      console.log(`[whatsapp-evolution] desconectar instance=${instanceName}`);

      try {
        await fetch(`${evolutionUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
          method: "DELETE",
          headers: { apikey: evolutionKey },
        });
      } catch (dErr) {
        console.warn("[whatsapp-evolution] Erro ao dar logout na Evolution:", dErr);
      }

      await supabase
        .from("imphq_wa_providers")
        .update({
          status: "disconnected",
          is_active: false,
          status_updated_at: new Date().toISOString(),
        })
        .eq("instance_name", instanceName);

      return jsonResponse({
        success: true,
        status: "disconnected",
        instance: instanceName,
      });
    }

    return jsonResponse(
      {
        success: false,
        error: `Ação desconhecida: "${action}". Ações válidas: gerar_qrcode, checar_status, desconectar.`,
      },
      400
    );
  } catch (err: any) {
    console.error("[whatsapp-evolution] Erro fatal:", err);
    return jsonResponse(
      {
        success: false,
        error: err?.message || String(err),
      },
      500
    );
  }
});
