import en from './en.json';

export type MessageKey = keyof typeof en;
const messages: Record<string, string> = en;

/** Looks up a UI string (NFR-I18N-01) and fills {placeholders}. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const template = messages[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/** For keys built at run time (e.g. `rule.${code}`); falls back when missing. */
export function tDynamic(key: string, fallback: MessageKey, vars: Record<string, string | number> = {}): string {
  return t((key in messages ? key : fallback) as MessageKey, vars);
}
