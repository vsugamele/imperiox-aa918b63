import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Calendar credentials not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN as secrets.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to refresh Google token: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, event, project_id, calendar_id } = await req.json();
    const calId = calendar_id || "primary";

    if (action === "sync_to_google") {
      // Push a single event to Google Calendar
      if (!event) throw new Error("Event data required");
      
      const accessToken = await getAccessToken();
      const gcalEvent = {
        summary: event.title,
        description: event.description || "",
        start: event.all_day
          ? { date: event.event_date.split("T")[0] }
          : { dateTime: event.event_date, timeZone: "America/Sao_Paulo" },
        end: event.end_date
          ? event.all_day
            ? { date: event.end_date.split("T")[0] }
            : { dateTime: event.end_date, timeZone: "America/Sao_Paulo" }
          : event.all_day
            ? { date: event.event_date.split("T")[0] }
            : { dateTime: event.event_date, timeZone: "America/Sao_Paulo" },
        reminders: event.reminder ? { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] } : { useDefault: true },
      };

      let googleEventId = event.google_event_id;
      let url: string;
      let method: string;

      if (googleEventId) {
        // Update existing
        url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${googleEventId}`;
        method = "PUT";
      } else {
        // Create new
        url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`;
        method = "POST";
      }

      const gRes = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gcalEvent),
      });

      if (!gRes.ok) {
        const errText = await gRes.text();
        throw new Error(`Google Calendar API error [${gRes.status}]: ${errText}`);
      }

      const gData = await gRes.json();
      googleEventId = gData.id;

      // Save google_event_id back to Supabase
      if (event.id) {
        await supabase
          .from("imphq_calendar_events")
          .update({ google_event_id: googleEventId })
          .eq("id", event.id);
      }

      return new Response(JSON.stringify({ success: true, google_event_id: googleEventId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync_from_google") {
      // Pull events from Google Calendar into Supabase
      if (!project_id) throw new Error("project_id required");
      
      const accessToken = await getAccessToken();
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

      const gRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=100&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!gRes.ok) {
        const errText = await gRes.text();
        throw new Error(`Google Calendar API error [${gRes.status}]: ${errText}`);
      }

      const gData = await gRes.json();
      const items = gData.items || [];
      let imported = 0;

      // Get auth user from request
      const authHeader = req.headers.get("authorization");
      let userId: string | null = null;
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      }
      if (!userId) throw new Error("Auth required");

      for (const item of items) {
        // Check if already imported
        const { data: existing } = await supabase
          .from("imphq_calendar_events")
          .select("id")
          .eq("google_event_id", item.id)
          .eq("project_id", project_id)
          .maybeSingle();

        if (existing) continue;

        const isAllDay = !!item.start?.date;
        const eventDate = isAllDay
          ? new Date(item.start.date + "T00:00:00").toISOString()
          : item.start?.dateTime || new Date().toISOString();
        const endDate = isAllDay
          ? (item.end?.date ? new Date(item.end.date + "T23:59:59").toISOString() : null)
          : (item.end?.dateTime || null);

        await supabase.from("imphq_calendar_events").insert({
          project_id,
          user_id: userId,
          title: item.summary || "Sem título",
          description: item.description || null,
          event_date: eventDate,
          end_date: endDate,
          event_type: "general",
          all_day: isAllDay,
          reminder: false,
          google_event_id: item.id,
        });
        imported++;
      }

      return new Response(JSON.stringify({ success: true, imported, total: items.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_from_google") {
      if (!event?.google_event_id) throw new Error("google_event_id required");
      
      const accessToken = await getAccessToken();
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${event.google_event_id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("google-calendar-sync error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
