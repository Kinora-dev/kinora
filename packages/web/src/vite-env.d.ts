/// <reference types="vite/client" />

// Strict import.meta.env: only the keys declared below (+ Vite built-ins) are
// allowed; unknown VITE_* access becomes a type error.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_KINORA_SERVER_URL: string
  readonly VITE_KINORA_VIEWER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
