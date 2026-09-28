import type { ReactNode } from "react";
import { isAccessDenied, isNotFound, DataAccessError } from "../data/contracts/errors";
import type { AsyncState } from "../hooks/useAsync";
import { Button, Card } from "./ui";

export function Skeleton({ className = "", height }: { className?: string; height?: number }) {
  return (
    <div
      className={`skeleton rounded-lg ${className}`}
      style={height ? { height } : undefined}
      aria-hidden
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Загрузка">
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={96} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton height={300} />
        <Skeleton height={300} />
      </div>
    </div>
  );
}

function StateBox({
  icon,
  title,
  note,
  action,
  tone = "accent",
}: {
  icon: ReactNode;
  title: string;
  note: string;
  action?: ReactNode;
  tone?: "accent" | "danger" | "warn";
}) {
  const toneCls =
    tone === "danger"
      ? "bg-danger-soft text-danger"
      : tone === "warn"
        ? "bg-warn-soft text-warn"
        : "bg-accent-soft text-accent";
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface-2 px-6 py-12 text-center">
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full ${toneCls}`}>
        {icon}
      </div>
      <p className="text-[14px] font-semibold text-fg">{title}</p>
      <p className="mt-1 max-w-md text-[12.5px] text-muted">{note}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const ICON_INFO = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M12 8v4M12 16h.01M12 2a10 10 0 100 20 10 10 0 000-20z" strokeLinecap="round" />
  </svg>
);

const ICON_LOCK = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 118 0v4" strokeLinecap="round" />
  </svg>
);

export function EmptyState({
  title,
  note,
  action,
}: {
  title: string;
  note: string;
  action?: ReactNode;
}) {
  return <StateBox icon={ICON_INFO} title={title} note={note} action={action} />;
}

export function ForbiddenState({
  title = "Недостаточно прав для просмотра",
  note,
  action,
}: {
  title?: string;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <StateBox
      icon={ICON_LOCK}
      tone="warn"
      title={title}
      note={
        note ??
        "Эти данные находятся вне вашей области доступа. Если доступ нужен для работы, обратитесь к администратору системы."
      }
      action={action}
    />
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (isAccessDenied(error)) return <ForbiddenState title={(error as Error).message} />;
  if (isNotFound(error)) return <EmptyState title="Не найдено" note={(error as Error).message} />;
  const msg =
    error instanceof DataAccessError || error instanceof Error
      ? error.message
      : "Неизвестная ошибка";
  return (
    <StateBox
      icon={ICON_INFO}
      tone="danger"
      title="Не удалось загрузить данные"
      note={msg}
      action={
        onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            Повторить
          </Button>
        ) : undefined
      }
    />
  );
}

/**
 * Единая обработка loading / error / empty / loaded для data-driven блоков.
 * При повторной загрузке показывает прежние данные с полупрозрачностью.
 */

export function Async<T>({
  state,
  children,
  skeleton,
  isEmpty,
  empty,
}: {
  state: AsyncState<T> & { reload?: () => void };
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
}) {
  if (state.status === "error") return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.data === undefined) return <>{skeleton ?? <Skeleton height={220} />}</>;
  if (isEmpty?.(state.data))
    return (
      <>
        {empty ?? (
          <EmptyState title="Нет данных" note="Для выбранных фильтров данные отсутствуют." />
        )}
      </>
    );
  return (
    <div
      className={
        state.status === "loading" ? "opacity-60 transition-opacity" : "transition-opacity"
      }
    >
      {children(state.data)}
    </div>
  );
}

export function MockNotice({ children }: { children: ReactNode }) {
  return (
    <Card className="border-dashed border-move bg-move-soft px-4 py-3 text-[12.5px] leading-snug text-move-fg">
      <b>Mock.</b> {children}
    </Card>
  );
}
