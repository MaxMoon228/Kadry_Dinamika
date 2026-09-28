import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AccessScope, Role, User } from "../domain/user";
import { can, scopeOf, type Permission } from "./access";
import { demoUsers } from "./demoUsers";

const SESSION_KEY = "kd-demo-role";

interface SessionCtx {
  user: User;
  scope: AccessScope;
  can: (p: Permission) => boolean;
  /** Только для демо: переключение роли имитирует вход другого пользователя. */
  switchRole: (role: Role) => void;
  getAccessToken: () => string | null;
}

const Ctx = createContext<SessionCtx | null>(null);

function initialRole(): Role {
  try {
    const r = sessionStorage.getItem(SESSION_KEY);
    if (r === "education_head" || r === "school_director" || r === "analyst") return r;
  } catch {
    /* ignore */
  }
  return "education_head";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const users = useMemo(demoUsers, []);
  const [role, setRole] = useState<Role>(initialRole);
  const user = users[role];
  const switchRole = useCallback((r: Role) => {
    setRole(r);
    try {
      sessionStorage.setItem(SESSION_KEY, r);
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo<SessionCtx>(
    () => ({
      user,
      scope: scopeOf(user),
      can: (p) => can(user, p),
      switchRole,
      getAccessToken: () => null,
    }),
    [user, switchRole],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession вне SessionProvider");
  return v;
}
