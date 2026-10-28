import { google } from "googleapis";
import { EXPORT_COLUMNS, overallStatus, preOnboardingComplete } from "./constants";

// The tab the app owns. The app writes it from the database and reads
// teammates' edits back from it (see lib/sheetPull.js).
export const SHEET_TAB = "App Data";
export const ID_HEADER = "Property ID";
export const READ_ONLY_HEADERS = ["Overall Status", "Pre-Onboarding Complete", "AGM Notes"];
export const HEADERS = [ID_HEADER, ...EXPORT_COLUMNS.map((c) => c[1]), ...READ_ONLY_HEADERS];

export function sheetId() {
  return process.env.SHEET_ID || process.env.GOOGLE_SHEET_ID || "";
}

// The whole service-account JSON key, pasted into one env var.
export function serviceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const creds = JSON.parse(raw);
    return creds.client_email && creds.private_key ? creds : null;
  } catch {
    return null;
  }
}

export function sheetsConfigured() {
  return !!(serviceAccount() && sheetId());
}

function sheetsClient() {
  const creds = serviceAccount();
  if (!creds || !sheetId()) {
    const err = new Error("Google Sheets sync isn't configured yet.");
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  const auth = new google.auth.JWT(creds.client_email, undefined, creds.private_key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
  return google.sheets({ version: "v4", auth });
}

export function cellString(v) {
  return v == null ? "" : String(v);
}

// The value a property shows in a given column. "Others" dropdowns export the typed name.
export function cellFor(p, key) {
  const pick = (ownerKey, otherKey) => (p[ownerKey] === "Others" ? p[otherKey] : p[ownerKey]);
  switch (key) {
    case "opsPreHandoverOwner": return pick("opsPreHandoverOwner", "opsPreHandoverOwnerOther");
    case "staffingAuditAgent": return pick("staffingAuditAgent", "staffingAuditAgentOther");
    case "inventoryReportAgent": return pick("inventoryReportAgent", "inventoryReportAgentOther");
    case "technicalAuditAgent": return pick("technicalAuditAgent", "technicalAuditAgentOther");
    default: return p[key];
  }
}

function agmNotesText(p) {
  return (p.agmNotes || [])
    .map((n) => {
      const d = new Date(n.date);
      const dstr = isNaN(d) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      return `${dstr}: ${n.text}`;
    })
    .join(" | ");
}

export function exportRow(p) {
  return [
    cellString(p.id),
    ...EXPORT_COLUMNS.map(([key]) => cellString(cellFor(p, key))),
    overallStatus(p),
    preOnboardingComplete(p),
    agmNotesText(p),
  ];
}

// Writes every property to the App Data tab. Returns the rows written, so the
// caller can record what the sheet now holds.
export async function exportPropertiesToSheet(properties) {
  const sheets = sheetsClient();
  const spreadsheetId = sheetId();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  let tab = (meta.data.sheets || []).find((s) => s.properties.title === SHEET_TAB);
  if (!tab) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_TAB } } }] },
    });
    tab = { properties: res.data.replies[0].addSheet.properties };
  }

  // Plain-text cells: otherwise Sheets reformats "2026-09-17" on display and the
  // next pull would read that back as an edit.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        repeatCell: {
          range: { sheetId: tab.properties.sheetId },
          cell: { userEnteredFormat: { numberFormat: { type: "TEXT" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      }],
    },
  });

  const rows = [HEADERS, ...properties.map(exportRow)];
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${SHEET_TAB}!A:ZZ` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TAB}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  return { url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, rows };
}

// Reads a tab as { headers, rows }, where each row is keyed by header name.
// Returns null if the tab doesn't exist.
export async function readTab(tabName) {
  const sheets = sheetsClient();
  const spreadsheetId = sheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  if (!(meta.data.sheets || []).some((s) => s.properties.title === tabName)) return null;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:ZZ`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = res.data.values || [];
  if (!values.length) return { headers: [], rows: [] };

  const headers = values[0].map((h) => String(h).trim());
  const rows = values.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = r[i] == null ? "" : String(r[i]).trim();
    });
    return obj;
  });
  return { headers, rows };
}
