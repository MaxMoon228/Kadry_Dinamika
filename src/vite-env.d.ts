/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "mock" (по умолчанию) или "api". */
  readonly VITE_DATA_SOURCE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MOCK_LATENCY_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
