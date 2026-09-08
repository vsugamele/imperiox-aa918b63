import { createContext, useContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  userRole: string | null;
  userStatus: string | null;
  isAdmin: boolean;
  isPending: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

export { type AuthContextType, AuthContext, useAuth };
