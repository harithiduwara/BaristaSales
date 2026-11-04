// Admin menu actions run by the Administrator inside the bound spreadsheet (FR-BE-01, OPS-01, OPS-03).
import { colomboIso } from '@aluthgama/shared';
import { PROP, setPins } from '../auth';
import { ensureConfigDefaults, ensureSecrets, seed } from '../core';
import {
  AUDIT_HEADERS,
  CONFIG_HEADERS,
  LOG_HEADERS,
  MONEY_COLUMNS,
  REPORT_HEADERS,
  SHARE_COLUMNS,
  SHEETS,
  TEXT_COLUMNS,
  WEATHER_HEADERS,
} from '../rows';
import { gasServices, TZ } from './services';

function ensureSheet(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  name: string,
  headers: readonly string[],
): GoogleAppsScript.Spreadsheet.Sheet {
  const sh = ss.getSheetByName(name) ?? ss.insertSheet(name);
  const current = sh.getRange(1, 1, 1, headers.length).getValues()[0] as unknown[];
  if (current.join('|') !== headers.join('|')) {
    sh.getRange(1, 1, 1, headers.length)
      .setValues([headers as string[]])
      .setFontWeight('bold');
  }
  sh.setFrozenRows(1);
  const maxRows = sh.getMaxRows();
  headers.forEach((h, i) => {
    const col = sh.getRange(2, i + 1, Math.max(1, maxRows - 1), 1);
    if (MONEY_COLUMNS.has(h)) col.setNumberFormat('#,##0.00');
    else if (SHARE_COLUMNS.has(h)) col.setNumberFormat('0.0%');
    else if (h === 'businessDate' || h === 'date') col.setNumberFormat('yyyy-mm-dd');
    else if (TEXT_COLUMNS.has(h)) col.setNumberFormat('@');
  });
  return sh;
}

/** Admin → Run setup. Idempotent. */
export function setup(): void {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROP.SHEET_ID, ss.getId());
  ss.setSpreadsheetTimeZone(TZ);
  ensureSheet(ss, SHEETS.reports, REPORT_HEADERS);
  ensureSheet(ss, SHEETS.log, LOG_HEADERS);
  ensureSheet(ss, SHEETS.weather, WEATHER_HEADERS);
  ensureSheet(ss, SHEETS.config, CONFIG_HEADERS);
  ensureSheet(ss, SHEETS.audit, AUDIT_HEADERS);
  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  const s = gasServices(ss);
  ensureSecrets(s);
  ensureConfigDefaults(s);
  s.store.appendAudit({ at: colomboIso(s.now()), event: 'setup', deviceId: '', detail: 'Run setup' });
  // Weather and backup triggers (FR-BE-04, FR-BE-05) are added in Phase 3.
  Logger.log(`Sheet: ${ss.getUrl()}`);
  SpreadsheetApp.getUi().alert(`Setup complete.\n\nNext: Admin → Set PINs.\n\nSheet: ${ss.getUrl()}`);
}

/** Admin → Set PINs. Stores salted hashes only and signs every device out (OPS-03). */
export function setPinsPrompt(): void {
  const ui = SpreadsheetApp.getUi();
  const ask = (label: string): string | null => {
    const r = ui.prompt('Set PINs', `${label} (6 digits):`, ui.ButtonSet.OK_CANCEL);
    return r.getSelectedButton() === ui.Button.OK ? r.getResponseText().trim() : null;
  };
  const manager = ask('New Manager PIN');
  if (manager === null) return;
  const owner = ask('New Owner PIN');
  if (owner === null) return;
  const s = gasServices();
  const result = setPins(s, manager, owner);
  if (!result.ok) {
    ui.alert(`PINs not changed. ${result.reason}`);
    return;
  }
  s.store.appendAudit({
    at: colomboIso(s.now()),
    event: 'pins_set',
    deviceId: '',
    detail: 'PINs changed; all devices signed out',
  });
  ui.alert('PINs saved. Every device must sign in again.');
}

/** Admin → Load seed data (8.6). */
export function loadSeedData(): void {
  const written = seed(gasServices());
  SpreadsheetApp.getUi().alert(
    written.length ? `Added reports for ${written.join(', ')}.` : 'Seed reports are already there.',
  );
}

export function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('Admin')
    .addItem('Run setup', 'setup')
    .addItem('Set PINs', 'setPinsPrompt')
    .addItem('Load seed data', 'loadSeedData')
    .addToUi();
}
