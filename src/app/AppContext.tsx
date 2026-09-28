import { createContext, useContext } from "react";
import type { Dictionaries, GlobalFilters } from "../data/contracts/dto";
import type { ForecastInput } from "../domain/forecast";
import type { Route } from "./router";

export interface AppCtx {
  route: Route;
  navigate: (r: Route) => void;
  /** Глобальные фильтры (год, округ) — хранятся в URL. */
  filters: GlobalFilters;
  setFilters: (patch: Partial<GlobalFilters>) => void;
  dictionaries: Dictionaries;
  /** Предзаполнение калькулятора из профиля педагога. */
  calculatorPrefill: ForecastInput | null;
  openCalculator: (input: ForecastInput | null) => void;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(AppContext);
  if (!v) throw new Error("useApp вне AppContext");
  return v;
}
