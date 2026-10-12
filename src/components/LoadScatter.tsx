import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoadPoint } from "../data/contracts/dto";
import { MOBILITY_KEY_BY_CLASS, MOBILITY_LABELS } from "../domain/mobility";
import { MOB } from "./mobility";

/**
 * Диаграмма рассеяния «Стаж педагогической работы × число разных предметов»
 * (аналог графика «Критическая нагрузка» из ноутбука «Неделя 5»). Десятки тысяч точек,
 * поэтому рисуется на canvas: базовый слой перерисовывается только при смене данных,
 * размера или темы, подсветка наведения — на отдельном слое.
 */

const PAD = { top: 18, right: 18, bottom: 44, left: 52 };
const HIT_RADIUS = 9;
const CELL = 14;

type Thresholds = { maxExperienceExclusive: number; minSubjects: number };

type Placed = { p: LoadPoint; px: number; py: number };

function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

/** Детерминированный разброс: значения целые, без него точки сливаются в сетку. */
function jitter(p: LoadPoint): [number, number] {
  const k = `${p.teacherId}|${p.year}`;
  return [(hash01(k) - 0.5) * 0.7, (hash01(`${k}#`) - 0.5) * 0.7];
}

function niceMax(v: number, step: number) {
  return Math.max(step, Math.ceil(v / step) * step);
}

function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return {
    grid: v("--chart-grid", "#ebe9f5"),
    axis: v("--chart-axis", "#6b6888"),
    base: v("--neon-indigo", "#6366f1"),
    base2: v("--neon-violet", "#8b5cf6"),
    critical: v("--danger", "#c2305f"),
    critical2: v("--neon-pink", "#d946ef"),
    zone: v("--danger", "#c2305f"),
    surface: v("--surface", "#ffffff"),
    font: getComputedStyle(document.body).fontFamily || "sans-serif",
  };
}

function useThemeVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const mo = new MutationObserver(() => setV((x) => x + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => mo.disconnect();
  }, []);
  return v;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    setW(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function setupCanvas(c: HTMLCanvasElement, w: number, h: number) {
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
}

export function LoadScatter({
  points,
  thresholds,
  height = 420,
  xLimit,
  onOpen,
}: {
  points: LoadPoint[];
  thresholds: Thresholds;
  height?: number;
  /** Ограничение оси стажа (приближение к зоне молодых педагогов); точки правее скрываются. */
  xLimit?: number;
  onOpen: (p: LoadPoint) => void;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const baseRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<HTMLCanvasElement>(null);
  const themeV = useThemeVersion();
  const [hover, setHover] = useState<Placed | null>(null);

  const domain = useMemo(() => {
    let mx = 0;
    let my = 0;
    for (const p of points) {
      if (xLimit != null && p.x > xLimit) continue;
      if (p.x > mx) mx = p.x;
      if (p.y > my) my = p.y;
    }
    return {
      xMin: -0.6,
      xMax: xLimit != null ? xLimit + 0.6 : niceMax(mx + 1, 5),
      yMin: 0,
      yMax: niceMax(my + 1, 5),
    };
  }, [points, xLimit]);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const sx = useCallback(
    (x: number) => PAD.left + ((x - domain.xMin) / (domain.xMax - domain.xMin)) * plotW,
    [domain, plotW],
  );
  const sy = useCallback(
    (y: number) => PAD.top + plotH - ((y - domain.yMin) / (domain.yMax - domain.yMin)) * plotH,
    [domain, plotH],
  );
  const zoomed = xLimit != null;

  const placed = useMemo<Placed[]>(() => {
    if (!plotW) return [];
    const spread = zoomed ? 0.82 : 1;
    const out: Placed[] = [];
    for (const p of points) {
      if (xLimit != null && p.x > xLimit) continue;
      const [jx, jy] = jitter(p);
      out.push({ p, px: sx(p.x + jx * spread), py: sy(Math.max(0.2, p.y + jy)) });
    }
    // Критические точки рисуются и ищутся последними — поверх остальных.
    return out.sort((a, b) => Number(a.p.critical) - Number(b.p.critical));
  }, [points, sx, sy, plotW, xLimit, zoomed]);

  const grid = useMemo(() => {
    const g = new Map<string, number[]>();
    placed.forEach((q, i) => {
      const k = `${Math.floor(q.px / CELL)}|${Math.floor(q.py / CELL)}`;
      const arr = g.get(k);
      if (arr) arr.push(i);
      else g.set(k, [i]);
    });
    return g;
  }, [placed]);

  // --- базовый слой
  useEffect(() => {
    const c = baseRef.current;
    if (!c || !width) return;
    const t = readTheme();
    const ctx = setupCanvas(c, width, height);
    ctx.font = `11.5px ${t.font}`;

    // сетка и подписи осей
    ctx.strokeStyle = t.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = t.axis;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const xStep = domain.xMax > 40 ? 10 : domain.xMax > 15 ? 5 : 1;
    for (let x = 0; x <= domain.xMax; x += xStep) {
      const X = Math.round(sx(x)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(X, PAD.top);
      ctx.lineTo(X, PAD.top + plotH);
      ctx.stroke();
      ctx.fillText(String(x), X, PAD.top + plotH + 8);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = 0; y <= domain.yMax; y += 5) {
      const Y = Math.round(sy(y)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD.left, Y);
      ctx.lineTo(PAD.left + plotW, Y);
      ctx.stroke();
      ctx.fillText(String(y), PAD.left - 8, Y);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Стаж педагогической работы, лет", PAD.left + plotW / 2, height - 6);
    ctx.save();
    ctx.translate(14, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Разных предметов (уроков)", 0, 0);
    ctx.restore();

    // зона критической нагрузки (стаж — целые годы, поэтому граница посередине между 1 и 2)
    const zx0 = sx(domain.xMin);
    const zx1 = sx(thresholds.maxExperienceExclusive - 0.5);
    const zy1 = sy(thresholds.minSubjects - 0.5);
    const zy0 = PAD.top;
    const zg = ctx.createLinearGradient(0, zy0, 0, zy1);
    zg.addColorStop(0, t.critical2);
    zg.addColorStop(1, t.zone);
    ctx.fillStyle = zg;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(zx0, zy0, zx1 - zx0, zy1 - zy0);
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = t.zone;
    ctx.strokeRect(zx0 + 0.5, zy0 + 0.5, zx1 - zx0 - 1, zy1 - zy0);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // обычные педагоги
    const rBase = zoomed ? 2.6 : placed.length > 30000 ? 1.8 : placed.length > 8000 ? 2.2 : 2.8;
    const bg = ctx.createLinearGradient(PAD.left, 0, PAD.left + plotW, 0);
    bg.addColorStop(0, t.base2);
    bg.addColorStop(1, t.base);
    ctx.fillStyle = bg;
    ctx.globalAlpha = placed.length > 30000 ? 0.28 : 0.4;
    ctx.beginPath();
    for (const q of placed) {
      if (q.p.critical) continue;
      ctx.moveTo(q.px + rBase, q.py);
      ctx.arc(q.px, q.py, rBase, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;

    // критическая нагрузка — ромбы с неоновым свечением
    const cg = ctx.createLinearGradient(zx0, zy0, zx1, zy1);
    cg.addColorStop(0, t.critical2);
    cg.addColorStop(1, t.critical);
    ctx.fillStyle = cg;
    ctx.shadowColor = t.critical2;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = t.surface;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const rCrit = zoomed ? 5.5 : 4.5;
    for (const q of placed) if (q.p.critical) diamond(ctx, q.px, q.py, rCrit);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [placed, width, height, domain, sx, sy, plotW, plotH, thresholds, themeV, zoomed]);

  // --- слой наведения
  useEffect(() => {
    const c = hoverRef.current;
    if (!c || !width) return;
    const ctx = setupCanvas(c, width, height);
    if (!hover) return;
    const t = readTheme();
    const color = hover.p.critical ? t.critical : t.base2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(hover.px, hover.py);
    ctx.lineTo(hover.px, PAD.top + plotH);
    ctx.moveTo(hover.px, hover.py);
    ctx.lineTo(PAD.left, hover.py);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (hover.p.critical) diamond(ctx, hover.px, hover.py, 8);
    else ctx.arc(hover.px, hover.py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = t.surface;
    ctx.stroke();
  }, [hover, width, height, plotH]);

  const pick = (e: React.MouseEvent): Placed | null => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const cx = Math.floor(mx / CELL);
    const cy = Math.floor(my / CELL);
    let best: Placed | null = null;
    let bestD = HIT_RADIUS * HIT_RADIUS;
    for (let gx = cx - 1; gx <= cx + 1; gx++)
      for (let gy = cy - 1; gy <= cy + 1; gy++)
        for (const i of grid.get(`${gx}|${gy}`) ?? []) {
          const q = placed[i];
          const d = (q.px - mx) ** 2 + (q.py - my) ** 2 - (q.p.critical ? 12 : 0);
          if (d <= bestD) {
            bestD = d;
            best = q;
          }
        }
    return best;
  };

  const tip = hover && <Bubble q={hover} width={width} height={height} />;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <canvas ref={baseRef} className="absolute inset-0" aria-hidden />
      <canvas
        ref={hoverRef}
        className="absolute inset-0"
        style={{ cursor: hover ? "pointer" : "crosshair" }}
        role="img"
        aria-label={`Диаграмма рассеяния: ${points.length} педагогов, стаж против числа предметов`}
        onMouseMove={(e) => {
          const q = pick(e);
          setHover((prev) => (prev?.p === q?.p ? prev : q));
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const q = pick(e);
          if (q) onOpen(q.p);
        }}
      />
      {tip}
    </div>
  );
}

function Bubble({ q, width, height }: { q: Placed; width: number; height: number }) {
  const W = 248;
  const left = q.px + 14 + W > width - 8 ? Math.max(8, q.px - W - 14) : q.px + 14;
  const flip = q.py > height * 0.55;
  const p = q.p;
  const key = p.status == null ? null : MOBILITY_KEY_BY_CLASS[p.status];
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-xl border border-[var(--glow-border)] bg-[var(--tooltip-bg)] px-3 py-2.5 text-[12px] leading-snug text-[var(--tooltip-text)] shadow-[0_14px_36px_-12px_var(--glow-strong)] backdrop-blur"
      style={{
        left,
        top: flip ? undefined : q.py + 12,
        bottom: flip ? height - q.py + 12 : undefined,
        width: W,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12.5px] font-semibold">{p.teacherId}</span>
        {p.critical ? (
          <span className="rounded-full bg-[var(--danger-soft)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--danger)]">
            Критическая нагрузка
          </span>
        ) : (
          <span className="text-[11px] text-[var(--chart-axis)]">{p.year} г.</span>
        )}
      </div>
      <div className="mt-1 text-[11.5px] text-[var(--chart-axis)]">
        {p.schoolName}
        {p.mainPosition ? ` · ${p.mainPosition}` : ""}
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-[var(--chart-axis)]">Пед. стаж</dt>
        <dd className="tnum font-medium">{p.x} лет</dd>
        <dt className="text-[var(--chart-axis)]">Предметов</dt>
        <dd className="tnum font-medium">{p.y}</dd>
        <dt className="text-[var(--chart-axis)]">Возраст</dt>
        <dd className="tnum font-medium">{p.age ?? "—"}</dd>
        <dt className="text-[var(--chart-axis)]">Категория</dt>
        <dd className="font-medium">{p.qualificationCategory ?? "Без категории"}</dd>
      </dl>
      {p.topSubjects.length > 0 && (
        <p className="mt-1.5 line-clamp-2 text-[11px] text-[var(--chart-axis)]">
          {p.topSubjects.join(", ")}
          {p.y > p.topSubjects.length ? "…" : ""}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-[var(--tooltip-border)] pt-1.5 text-[11px]">
        {key ? (
          <span className="inline-flex items-center gap-1 font-medium" style={{ color: MOB[key].fg }}>
            {MOB[key].icon(11)} {MOBILITY_LABELS[key].short} · {p.year}→{p.year + 1}
          </span>
        ) : (
          <span className="text-[var(--chart-axis)]">Исход ещё не наблюдается</span>
        )}
        <span className="font-semibold text-[var(--accent)]">Открыть →</span>
      </div>
    </div>
  );
}
