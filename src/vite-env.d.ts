/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_TLDRAW_SYNC_URL?: string
	readonly VITE_TLDRAW_AGENT_WS_URL?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
