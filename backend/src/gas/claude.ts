// CR-01: Claude Messages API over plain HTTPS from Apps Script (no SDK runs in Apps Script). ADR-0013.
import type { Ai, AiRequest, AiResult } from '../ports';

export const ANTHROPIC_API_KEY_PROP = 'ANTHROPIC_API_KEY';
const URL = 'https://api.anthropic.com/v1/messages';
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

interface MessagesResponse {
  model?: string;
  stop_reason?: string;
  content?: { type: string; text?: string }[];
  error?: { type?: string; message?: string };
}

export class ClaudeAi implements Ai {
  complete(req: AiRequest): AiResult {
    const key = PropertiesService.getScriptProperties().getProperty(ANTHROPIC_API_KEY_PROP);
    if (!key) return { ok: false, reason: 'notConfigured', detail: 'ANTHROPIC_API_KEY is not set' };
    const body = {
      model: req.model,
      max_tokens: 4000,
      // A short summary: low effort keeps it fast and cheap. Thinking stays adaptive (the model default).
      output_config: { effort: 'low' },
      // If the model declines, the API retries on a suitable fallback model in the same call.
      fallbacks: 'default',
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    };
    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2026-10-21',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    };
    let lastDetail = '';
    // One retry for rate limits, overload and 5xx, honouring retry-after up to 8 s.
    for (let attempt = 0; attempt < 2; attempt++) {
      let status = 0;
      let text = '';
      let headers: Record<string, unknown> = {};
      try {
        const res = UrlFetchApp.fetch(URL, options);
        status = res.getResponseCode();
        text = res.getContentText();
        headers = res.getHeaders() as Record<string, unknown>;
      } catch (e) {
        lastDetail = `network: ${e instanceof Error ? e.message : String(e)}`;
        Utilities.sleep(2000);
        continue;
      }
      let json: MessagesResponse = {};
      try {
        json = JSON.parse(text) as MessagesResponse;
      } catch {
        json = {};
      }
      if (status === 200) {
        if (json.stop_reason === 'refusal') return { ok: false, reason: 'refused', detail: 'model declined' };
        const out = (json.content ?? [])
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('')
          .trim();
        if (!out)
          return { ok: false, reason: 'error', detail: `empty response (${json.stop_reason ?? 'unknown'})` };
        return { ok: true, text: out, model: json.model ?? req.model };
      }
      lastDetail = `HTTP ${status} ${json.error?.type ?? ''} ${json.error?.message ?? ''}`.trim();
      if (status === 401 || status === 403) return { ok: false, reason: 'notConfigured', detail: lastDetail };
      if (!RETRYABLE.has(status) || attempt === 1) break;
      const after = Number(headers['retry-after'] ?? headers['Retry-After'] ?? 2);
      Utilities.sleep(Math.min(8, Number.isFinite(after) ? after : 2) * 1000);
    }
    return { ok: false, reason: 'error', detail: lastDetail };
  }
}
