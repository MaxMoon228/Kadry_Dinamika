/** Экран до первого рендера приложения: загрузка датасета или ошибка его загрузки. */

export function BootScreen({ error }: { error?: string }) {
  return (
    <div className="ambient-bg flex min-h-screen items-center justify-center bg-canvas p-6 text-fg">
      <div className="card-glow w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-center">
        {error ? (
          <>
            <p className="grad-text font-display text-[20px] font-semibold">
              Не удалось загрузить данные
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">{error}</p>
            <p className="mt-3 text-[12px] text-muted">
              Чтобы открыть демо на синтетике, запустите сайт с VITE_DATA_SOURCE=mock.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-line border-t-accent" />
            <p className="mt-4 text-[14px] font-medium">Загрузка датасета…</p>
            <p className="mt-1 text-[12px] text-muted">Реальные данные ДОНМ 2022–2024</p>
          </>
        )}
      </div>
    </div>
  );
}
