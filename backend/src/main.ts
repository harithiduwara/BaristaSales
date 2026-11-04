// Apps Script entry points. build.mjs turns each export into a top-level function (C-03).
import { handleGet, handlePost } from './core';
import { gasServices } from './gas/services';

export { onOpen, setup, setPinsPrompt, loadSeedData } from './gas/admin';

const json = (o: unknown) =>
  ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

export function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  return json(handlePost(gasServices(), e?.postData?.contents ?? ''));
}

export function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  const params = (e?.parameter ?? {}) as Record<string, string | undefined>;
  // Health needs no spreadsheet access.
  if (params.action === 'health') return json(handleGet({ now: () => Date.now() } as never, params));
  return json(handleGet(gasServices(), params));
}
