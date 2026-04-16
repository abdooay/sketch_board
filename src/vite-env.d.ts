/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_TLDRAW_SYNC_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
