import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSession } from "../auth/SessionProvider";
import type { DataSource } from "./contracts/repositories";
import { createDataSource } from "./index";

const Ctx = createContext<DataSource | null>(null);

/** Пересоздаёт DataSource при смене пользователя — scope всегда соответствует сессии. */

export function DataProvider({ children, source }: { children: ReactNode; source?: DataSource }) {
  const { user, getAccessToken } = useSession();
  const ds = useMemo(
    () => source ?? createDataSource(user, getAccessToken),
    [source, user, getAccessToken],
  );
  return <Ctx.Provider value={ds}>{children}</Ctx.Provider>;
}

export function useData(): DataSource {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData вне DataProvider");
  return v;
}
