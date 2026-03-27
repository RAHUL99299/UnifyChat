/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SIGNALING_URL?: string;
	readonly VITE_WEB_PUSH_PUBLIC_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
