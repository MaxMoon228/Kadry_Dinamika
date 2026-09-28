import { useEffect, useId, useState, type ReactNode } from "react";

export function fmt(n: number | null | undefined, digits?: number): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(
    "ru-RU",
    digits != null ? { maximumFractionDigits: digits, minimumFractionDigits: digits } : undefined,
  );
}

export function pct(n: number | null | undefined): string {
  return n == null ? "—" : `${fmt(n)}%`;
}

export function signed(n: number | null | undefined, suffix = ""): string | undefined {
  if (n == null) return undefined;
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : ""}${fmt(r)}${suffix}`;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`card-glow rounded-xl border border-line bg-surface shadow-[var(--shadow-sm)] ${className}`}
    >
      {children}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-2 px-5 py-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <span className="grad-accent h-3.5 w-1 shrink-0 rounded-full" aria-hidden />
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg border border-[var(--tooltip-border)] bg-[var(--tooltip-bg)] px-3 py-2 text-[12px] leading-snug font-normal text-[var(--tooltip-text)] shadow-[var(--shadow-lg)]"
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function Info({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <span
        tabIndex={0}
        aria-label={text}
        className="ml-1 inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-faint text-[9px] font-semibold text-muted"
      >
        i
      </span>
    </Tooltip>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 64;
  const h = 22;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");
  const id = useId().replace(/:/g, "");
  const lastY = h - ((data[data.length - 1] - min) / range) * h;
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`spk-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <filter id={`spkglow-${id}`} x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#spk-${id})`} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeOpacity={0.45}
        filter={`url(#spkglow-${id})`}
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={w}
        cy={lastY}
        r={2.4}
        fill={color}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaGood,
  deltaLabel = "к пред. году",
  spark,
  sparkColor = "var(--accent)",
  info,
  accent,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaGood?: boolean | null;
  deltaLabel?: string;
  spark?: number[];
  sparkColor?: string;
  info?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  const dColor =
    deltaGood == null ? "var(--text-muted)" : deltaGood ? "var(--success)" : "var(--danger)";
  return (
    <Card className="p-4">
      <div className="flex items-center text-[12px] font-medium text-muted">
        {icon ? (
          <span className="mr-1.5">{icon}</span>
        ) : (
          accent && (
            <span className="mr-2 h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
          )
        )}
        <span className="truncate">{label}</span>
        {info && <Info text={info} />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="tnum font-display text-[26px] leading-none font-semibold text-fg">
          {value}
          {unit && value !== "—" && (
            <span className="ml-1 text-[13px] font-medium text-muted">{unit}</span>
          )}
        </div>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
      {delta && (
        <div
          className="mt-2 flex items-center gap-1 text-[12px] font-medium"
          style={{ color: dColor }}
        >
          <span>{delta}</span>
          <span className="text-muted">{deltaLabel}</span>
        </div>
      )}
    </Card>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warn";
}) {
  const styles =
    tone === "accent"
      ? "bg-accent-soft text-accent-strong"
      : tone === "warn"
        ? "bg-warn-soft text-warn"
        : "bg-surface-2 text-fg-2 border border-line-2";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium ${styles}`}
    >
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors ${
            value === o.value
              ? "bg-surface text-accent-strong shadow-[0_2px_10px_-4px_var(--glow-strong)] ring-1 ring-[var(--glow-border)]"
              : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const fieldCls =
  "rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-fg outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted";

export function Select<V extends string>({
  value,
  onChange,
  options,
  className = "",
  disabled,
  ariaLabel,
}: {
  value: V;
  onChange: (v: V) => void;
  options: (V | { value: V; label: string })[];
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as V)}
      className={`${fieldCls} ${className}`}
    >
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

export function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-fg-2">{label}</span>
      {children}
      {error ? (
        <span className="text-[11.5px] font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="text-[11.5px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({
  invalid,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={`${fieldCls} ${invalid ? "border-danger" : ""} ${className}`}
    />
  );
}

export function Button({
  children,
  variant = "primary",
  onClick,
  className = "",
  disabled,
  type = "button",
  ariaLabel,
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "outline";
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
}) {
  const styles =
    variant === "primary"
      ? "btn-neon"
      : variant === "outline"
        ? "border border-line bg-surface text-fg hover:bg-hover"
        : "text-fg-2 hover:bg-hover";
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`relative px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
            value === t.value ? "text-accent-strong" : "text-muted hover:text-fg"
          }`}
        >
          {t.label}
          {value === t.value && (
            <span
              aria-hidden
              className="absolute inset-x-2 -bottom-px h-[2px] rounded-full"
              style={{ background: "var(--grad-line)", boxShadow: "0 0 10px var(--glow-strong)" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

export function Th({
  children,
  onClick,
  active,
  dir,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={`sticky top-0 z-10 border-b border-line bg-surface-2 px-3 py-2.5 text-[11.5px] font-semibold tracking-wide whitespace-nowrap text-muted uppercase ${
        onClick ? "cursor-pointer select-none hover:text-fg" : ""
      } ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-accent">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

export function useSort<K extends string>(initial: K | null, initialDir: "asc" | "desc" = "desc") {
  const [key, setKey] = useState<K | null>(initial);
  const [dir, setDir] = useState<"asc" | "desc">(initialDir);
  function toggle(k: K) {
    if (key === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setKey(k);
      setDir("desc");
    }
  }
  function sort<T>(rows: T[], get: (row: T, key: K) => number | string | null): T[] {
    if (!key) return rows;
    const m = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a, key);
      const bv = get(b, key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * m;
      return String(av).localeCompare(String(bv), "ru") * m;
    });
  }
  return { key, dir, toggle, sort };
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open, onClose]);
}

export function Drawer({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} />
      <div className="absolute top-0 right-0 flex h-full w-full max-w-[380px] flex-col border-l border-line bg-surface shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-md p-1 text-muted hover:bg-hover"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-2xl overflow-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-lg)]">
        {children}
      </div>
    </div>
  );
}

export function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1.5 pl-2.5 text-[12px] text-fg-2">
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Сбросить: ${label}`}
          className="flex h-4 w-4 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
}

export function DemoTag({ label = "Демонстрационные данные (mock)" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-move bg-move-soft px-2 py-0.5 text-[11px] font-semibold text-move-fg">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        aria-hidden
      >
        <path
          d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}

export function PageHead({
  title,
  subtitle,
  note,
  right,
}: {
  title: string;
  subtitle: string;
  note?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="grad-text text-[28px] leading-tight font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-[14px] text-muted">{subtitle}</p>
        {note && (
          <div className="mt-3 inline-flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] text-fg-2">
            <span className="mt-0.5 text-accent">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path
                  d="M12 16v-4M12 8h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            {note}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="tnum mt-1 text-[20px] font-semibold text-fg">{value}</div>
    </div>
  );
}

export function InfoRows({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <Card>
      <div className="border-b border-line-2 px-5 py-3.5 text-[15px] font-semibold text-fg">
        {title}
      </div>
      <dl className="divide-y divide-[var(--border-subtle)]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-5 py-2.5">
            <dt className="text-[13px] text-muted">{k}</dt>
            <dd className="text-right text-[13px] font-medium text-fg">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-fg-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
