import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Extract user id from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerId = caller.id;

    // Check admin role via security definer function
    const { data: isAdmin } = await adminClient.rpc("is_imphq_admin", { _user_id: callerId });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // LIST USERS
    if (action === "list") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 100 });
      if (error) throw error;

      // Get roles with status
      const { data: roles } = await adminClient.from("imphq_user_roles").select("*");
      const roleMap: Record<string, { role: string; status: string }> = {};
      const imphqUserIds = new Set<string>();
      (roles || []).forEach((r: any) => {
        roleMap[r.user_id] = { role: r.role, status: r.status || "approved" };
        imphqUserIds.add(r.user_id);
      });

      // Get team members
      const { data: teamMembers } = await adminClient.from("imphq_team_members").select("*");
      const teamMap: Record<string, any> = {};
      const teamByEmail: Record<string, any> = {};
      (teamMembers || []).forEach((t: any) => {
        if (t.user_id) {
          imphqUserIds.add(t.user_id);
          teamMap[t.user_id] = t;
        }
        if (t.email) {
          teamByEmail[t.email.toLowerCase()] = t;
        }
      });

      // Build user list: auth users that are in imphq scope
      const mapped = users
        .filter((u: any) => imphqUserIds.has(u.id))
        .map((u: any) => {
          const roleInfo = roleMap[u.id];
          const team = teamMap[u.id];
          return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            banned: u.banned_until ? true : false,
            role: roleInfo?.role || "user",
            status: roleInfo?.status || "approved",
            team_name: team?.name || null,
            team_role: team?.role || null,
            team_department: team?.department || null,
            is_team_member: !!team,
          };
        });

      // Also include team members WITHOUT auth accounts (not yet registered)
      const authEmails = new Set(users.map((u: any) => u.email?.toLowerCase()));
      const unlinkedTeam = (teamMembers || [])
        .filter((t: any) => !t.user_id && t.email && !authEmails.has(t.email.toLowerCase()))
        .map((t: any) => ({
          id: `team_${t.id}`,
          email: t.email,
          created_at: t.created_at,
          last_sign_in_at: null,
          banned: false,
          role: t.role?.toLowerCase() || "viewer",
          status: "invited", // not yet registered
          team_name: t.name,
          team_role: t.role,
          team_department: t.department,
          is_team_member: true,
        }));

      return new Response(JSON.stringify({ users: [...mapped, ...unlinkedTeam] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // CREATE USER
    if (action === "create") {
      const body = await req.json();
      const { email, password, role } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "email and password required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;

      if (data.user) {
        // Admin-created users are auto-approved
        await adminClient.from("imphq_user_roles").upsert(
          { user_id: data.user.id, role: role || "editor", status: "approved" },
          { onConflict: "user_id,role" }
        );
      }

      return new Response(JSON.stringify({ user: data.user }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SET PASSWORD
    if (action === "set_password") {
      const body = await req.json();
      const { user_id, password } = body;
      if (!user_id || !password) {
        return new Response(JSON.stringify({ error: "user_id and password required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // SET ROLE
    if (action === "set_role") {
      const body = await req.json();
      const { user_id, role } = body;
      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: "user_id and role required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Delete old role then insert new
      await adminClient.from("imphq_user_roles").delete().eq("user_id", user_id);
      if (role !== "none") {
        await adminClient.from("imphq_user_roles").insert({ user_id, role, status: "approved" });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // APPROVE / REJECT USER
    if (action === "set_status") {
      const body = await req.json();
      const { user_id, status } = body;
      if (!user_id || !status) {
        return new Response(JSON.stringify({ error: "user_id and status required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!["approved", "rejected", "pending"].includes(status)) {
        return new Response(JSON.stringify({ error: "Invalid status" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error } = await adminClient
        .from("imphq_user_roles")
        .update({ status })
        .eq("user_id", user_id);

      if (error) throw error;

      // If rejecting, also ban
      if (status === "rejected") {
        await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "876000h" } as any);
      }
      // If approving, unban
      if (status === "approved") {
        await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "none" } as any);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // BAN / UNBAN
    if (action === "toggle_ban") {
      const body = await req.json();
      const { user_id, ban } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const updateData = ban
        ? { ban_duration: "876000h" }
        : { ban_duration: "none" };

      const { error } = await adminClient.auth.admin.updateUserById(user_id, updateData as any);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
