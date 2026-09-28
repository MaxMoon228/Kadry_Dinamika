import { useTheme, type ThemePreference } from "../theme/ThemeProvider";

const OPTIONS: { value: ThemePreference; label: string; path: string }[] = [
  {
    value: "light",
    label: "Светлая тема",
    path: "M12 4V2M12 22v-2M4.93 4.93L3.51 3.51M20.49 20.49l-1.42-1.42M4 12H2M22 12h-2M4.93 19.07l-1.42 1.42M20.49 3.51l-1.42 1.42M12 17a5 5 0 100-10 5 5 0 000 10z",
  },
  {
    value: "dark",
    label: "Тёмная тема",
    path: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  },
  {
    value: "system",
    label: "Как в системе",
    path: "M4 5h16v11H4zM8 20h8M12 16v4",
  },
];

export default function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Тема оформления"
      className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={preference === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => setPreference(o.value)}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            preference === o.value
              ? "bg-surface text-accent shadow-[var(--shadow-sm)]"
              : "text-muted hover:text-fg"
          }`}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d={o.path} />
          </svg>
        </button>
      ))}
    </div>
  );
}
