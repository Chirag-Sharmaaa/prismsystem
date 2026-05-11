import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase, AppUser, Role, Category } from "./supabase";

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  enterGuest: () => void;
  exitGuest: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const loadProfile = useCallback(async (uid: string, email: string) => {
    const { data } = await supabase.from("users").select("*").eq("id", uid).maybeSingle();
    if (data) {
      setUser(data as AppUser);
    } else {
      // Create a default profile row
      const fallback: AppUser = {
        id: uid,
        email,
        name: email.split("@")[0],
        role: "manager",
        category_access: [],
      };
      await supabase.from("users").insert(fallback);
      setUser(fallback);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsGuest(localStorage.getItem("prism-guest") === "true");
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setIsGuest(false);
        if (typeof window !== "undefined") localStorage.removeItem("prism-guest");
        loadProfile(session.user.id, session.user.email || "");
      } else {
        setUser(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        loadProfile(data.session.user.id, data.session.user.email || "").finally(() =>
          setLoading(false),
        );
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    if (typeof window !== "undefined") localStorage.removeItem("prism-guest");
    setIsGuest(false);
  };

  const enterGuest = () => {
    if (typeof window !== "undefined") localStorage.setItem("prism-guest", "true");
    setIsGuest(true);
  };

  const exitGuest = () => {
    if (typeof window !== "undefined") localStorage.removeItem("prism-guest");
    setIsGuest(false);
  };

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) await loadProfile(data.user.id, data.user.email || "");
  };

  return (
    <AuthCtx.Provider
      value={{ user, loading, isGuest, signIn, signOut, enterGuest, exitGuest, refreshProfile }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export type Action =
  | "edit"
  | "comment"
  | "delete_comment"
  | "upload"
  | "delete_doc"
  | "status"
  | "import"
  | "delete_project"
  | "admin";

export function can(
  user: AppUser | null,
  isGuest: boolean,
  action: Action,
  category?: Category | null,
): boolean {
  if (isGuest || !user) return false;
  const role = user.role;
  if (role === "admin" || role === "scientist_e") return true;
  if (role === "manager") {
    const hasCat = category ? user.category_access?.includes(category) ?? false : true;
    if (!hasCat) return false;
    switch (action) {
      case "edit":
      case "comment":
      case "upload":
      case "status":
      case "import":
        return true;
      default:
        return false;
    }
  }
  return false;
}
