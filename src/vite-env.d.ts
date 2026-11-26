/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public FastAPI base URL, e.g. https://api.example.com/api. Empty -> dev proxy `/api`. */
  readonly VITE_API_BASE_URL?: string;
  /** "true" => use public/browser-data + ONNX in the browser, no FastAPI. */
  readonly VITE_BROWSER_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
