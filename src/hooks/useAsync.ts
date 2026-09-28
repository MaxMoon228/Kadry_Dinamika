import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export type AsyncState<T> =
  | {
      status: "loading";
      data: T | undefined;
      error: null;
    }
  | { status: "error"; data: undefined; error: unknown }
  | {
      status: "success";
      data: T;
      error: null;
    };

/**
 * Загрузка данных из репозитория с состояниями loading / error / success.
 * Устаревшие ответы (после смены фильтров) отбрасываются.
 */

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: DependencyList,
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    status: "loading",
    data: undefined,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const req = useRef(0);
  useEffect(() => {
    const id = ++req.current;
    setState((s) => ({ status: "loading", data: s.data, error: null }));
    fn().then(
      (data) => id === req.current && setState({ status: "success", data, error: null }),
      (error: unknown) =>
        id === req.current && setState({ status: "error", data: undefined, error }),
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
