import { AuthContextType, AuthContext, useAuth } from "@/contexts/auth-context";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";





export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);

  const fetchRole = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("imphq_user_roles")
        .select("role, status")
        .eq("user_id", userId)
        .maybeSingle();
      setUserRole(data?.role || null);
        setUserStatus(data?.status || null);
    } catch {
      setUserRole(null);
      setUserStatus(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setTimeout(() => fetchRole(session.user.id), 0);
      } else {
        setUserRole(null);
        setUserStatus(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isPending = userStatus === "pending" || userStatus === "rejected";

  return (
    <AuthContext.Provider value={{ session, user, loading, userRole, userStatus, isAdmin: userRole === "admin", isPending, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
