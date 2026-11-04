declare const __APP_VERSION__: string;

/** The Apps Script /exec URL, injected at build time (7.1). */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
/** versionName (AND-05). */
export const APP_VERSION: string = __APP_VERSION__;
