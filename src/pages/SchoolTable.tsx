import { Th, fmt, useSort } from "../components/ui";
import type { SchoolSummaryRow } from "../data/contracts/dto";

type Key =
  | "name"
  | "district"
  | "buildingCount"
  | "teacherCount"
  | "studentCount"
  | "studentsPerTeacher"
  | "avgAge"
  | "under35Share"
  | "stay"
  | "move"
  | "leave"
  | "teacherCountChange";

export default function SchoolTable({
  rows,
  onOpen,
  extended,
}: {
  rows: SchoolSummaryRow[];
  onOpen: (id: string) => void;
  extended?: boolean;
}) {
  const { key, dir, toggle, sort } = useSort<Key>("leave");
  const get = (r: SchoolSummaryRow, k: Key): number | string | null => {
    if (k === "stay" || k === "move" || k === "leave")
      return r.mobility && !r.mobility.suppressed ? r.mobility.shares[k] : null;
    return r[k];
  };
  const sorted = sort(rows, get);
  const maxLeave = Math.max(
    ...rows.map((r) => (r.mobility && !r.mobility.suppressed ? r.mobility.shares.leave : -1)),
  );
  const th = (k: Key, label: string, right = true) => (
    <Th onClick={() => toggle(k)} active={key === k} dir={dir} align={right ? "right" : "left"}>
      {label}
    </Th>
  );
  const mobCell = (r: SchoolSummaryRow, k: "stay" | "move" | "leave") => {
    if (!r.mobility) return "—";
    if (r.mobility.suppressed)
      return (
        <span className="text-faint" title="Мало наблюдений">
          н/д
        </span>
      );
    return `${fmt(r.mobility.shares[k])}%`;
  };
  return (
    <div className="-mx-5 -mb-5 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {th("name", "Школа", false)}
            {th("district", "Округ", false)}
            {extended && th("buildingCount", "Зданий")}
            {th("teacherCount", "Педагогов")}
            {th("studentCount", "Учащихся")}
            {th("studentsPerTeacher", "Уч./педагог")}
            {extended && th("avgAge", "Ср. возраст")}
            {extended && th("under35Share", "До 35")}
            {th("stay", "Остались")}
            {th("move", "Перешли")}
            {th("leave", "Ушли")}
            {th("teacherCountChange", "Δ числ.")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr
              key={s.schoolId}
              tabIndex={0}
              onClick={() => onOpen(s.schoolId)}
              onKeyDown={(e) => e.key === "Enter" && onOpen(s.schoolId)}
              className="cursor-pointer border-b border-line-2 text-fg hover:bg-hover focus:bg-hover focus:outline-none"
            >
              <td className="px-3 py-2.5 font-medium">{s.name}</td>
              <td className="px-3 py-2.5 text-fg-2">{s.district}</td>
              {extended && <td className="tnum px-3 py-2.5 text-right">{fmt(s.buildingCount)}</td>}
              <td className="tnum px-3 py-2.5 text-right">{fmt(s.teacherCount)}</td>
              <td className="tnum px-3 py-2.5 text-right">{fmt(s.studentCount)}</td>
              <td className="tnum px-3 py-2.5 text-right">{fmt(s.studentsPerTeacher)}</td>
              {extended && <td className="tnum px-3 py-2.5 text-right">{fmt(s.avgAge)}</td>}
              {extended && (
                <td className="tnum px-3 py-2.5 text-right">
                  {s.under35Share == null ? "—" : `${fmt(s.under35Share)}%`}
                </td>
              )}
              <td className="tnum px-3 py-2.5 text-right text-fg-2">{mobCell(s, "stay")}</td>
              <td className="tnum px-3 py-2.5 text-right text-fg-2">{mobCell(s, "move")}</td>
              <td className="tnum px-3 py-2.5 text-right font-semibold">
                <span
                  className={
                    s.mobility && !s.mobility.suppressed && s.mobility.shares.leave === maxLeave
                      ? "rounded bg-leave-soft px-1.5 py-0.5 text-leave-fg"
                      : ""
                  }
                >
                  {mobCell(s, "leave")}
                </span>
              </td>
              <td
                className="tnum px-3 py-2.5 text-right font-medium"
                style={{
                  color:
                    s.teacherCountChange == null
                      ? undefined
                      : s.teacherCountChange < 0
                        ? "var(--danger)"
                        : "var(--success)",
                }}
              >
                {s.teacherCountChange == null
                  ? "—"
                  : `${s.teacherCountChange > 0 ? "+" : ""}${s.teacherCountChange}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
