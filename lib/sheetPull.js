import { randomUUID } from "crypto";
import { query } from "./db";
import { logAudit } from "./audit";
import { partForField, partSavedAtKey } from "./access";
import { EXPORT_COLUMNS, OPS_OWNERS, STAFF_INV_AGENTS, TECH_AGENTS } from "./constants";
import { ID_HEADER, SHEET_TAB, cellFor, cellString, readTab } from "./sheets";
import { loadSnapshots } from "./sheetSnapshot";

const DATE_KEYS = new Set(["acquisitionDate", "opsPreHandoverDate", "targetGoLiveDate", "goLiveStartDate"]);

// Dropdown fields where a typed "Others" name is stored alongside.
const OWNER_FIELDS = {
  opsPreHandoverOwner: { other: "opsPreHandoverOwnerOther", list: OPS_OWNERS },
  staffingAuditAgent: { other: "staffingAuditAgentOther", list: STAFF_INV_AGENTS },
  inventoryReportAgent: { other: "inventoryReportAgentOther", list: STAFF_INV_AGENTS },
  technicalAuditAgent: { other: "technicalAuditAgentOther", list: TECH_AGENTS },
};

// Accepts "2026-09-17" as-is; turns "9/17/2026" or "17 Sep 2026" into "2026-09-17".
export function normaliseDate(s) {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d)) return s;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Writes a sheet cell into the stored property data, using the same shape the form saves.
export function applyCell(data, key, text) {
  const owner = OWNER_FIELDS[key];
  if (owner) {
    if (!text) { data[key] = ""; data[owner.other] = ""; }
    else if (owner.list.includes(text)) { data[key] = text; data[owner.other] = ""; }
    else { data[key] = "Others"; data[owner.other] = text; }
    return;
  }
  if (key === "bedrooms") {
    const n = Number(text);
    data[key] = text === "" ? "" : isNaN(n) ? text : n;
    return;
  }
  if (DATE_KEYS.has(key)) { data[key] = normaliseDate(text); return; }
  data[key] = text;
}

// What a cell would store, so a hand-typed "9/17/2026" matching "2026-09-17" is not a change.
function canonicalCell(key, text) {
  if (OWNER_FIELDS[key]) return text;
  const scratch = {};
  applyCell(scratch, key, text);
  return cellString(scratch[key]);
}

function stampParts(data, keys, now) {
  for (const k of keys) {
    const part = partForField(k);
    if (!part) continue;
    const savedKey = partSavedAtKey(part);
    const v = data[k];
    if (!data[savedKey] && v !== "" && v != null) data[savedKey] = now;
  }
}

// Brings edits from a sheet tab into the database.
//
// Per cell, with `base` = what the app last wrote to the sheet:
//   sheet == base            -> nothing from the sheet; the database value stands
//   sheet != base            -> a teammate changed it; the sheet value is applied
// If the app also changed the same cell since the last push, the sheet still wins
// and the audit entry lists it under `conflicts`.
//
// Unlike the form, sheet edits are not blocked by the 24-hour part lock, and they
// are always written to the audit log. Overall Status, Pre-Onboarding Complete and
// AGM Notes are read-only from the sheet. A row with no Property ID is created as
// a new property. A row whose ID is no longer in the database is ignored, and the
// next push removes it from the sheet.
export async function pullFromSheet({ tab = SHEET_TAB, editor = null } = {}) {
  const summary = { created: 0, updated: 0, unchanged: 0, skipped: 0, conflicts: 0, missingTab: false };
  const sheet = await readTab(tab);
  if (!sheet) {
    summary.missingTab = true;
    return summary;
  }

  const snapshots = await loadSnapshots();
  const res = await query("SELECT id, data FROM properties");
  const byId = new Map(res.rows.map((r) => [r.id, r.data]));
  const exportIndex = new Map(EXPORT_COLUMNS.map(([key], i) => [key, i + 1])); // +1 for the ID column
  const actor = editor || "Google Sheet";
  const now = new Date().toISOString();

  for (const row of sheet.rows) {
    const id = row[ID_HEADER] || "";
    const name = row["Property Name"] || "";
    if (!id && !name) continue;

    if (!id) {
      const data = { agmNotes: [], createdAt: now };
      for (const [key, label] of EXPORT_COLUMNS) {
        if (label in row) applyCell(data, key, row[label]);
      }
      stampParts(data, Object.keys(data), now);
      const newId = randomUUID();
      await query("INSERT INTO properties (id, data) VALUES ($1, $2::jsonb)", [newId, JSON.stringify(data)]);
      await logAudit({ propertyId: newId, actorEmail: actor, actorRole: "sheet", action: "sheet_create", changes: data });
      summary.created++;
      continue;
    }

    const current = byId.get(id);
    if (!current) { summary.skipped++; continue; }

    const data = { ...current };
    const snap = snapshots.get(id);
    const changes = {};
    const conflicts = [];

    for (const [key, label] of EXPORT_COLUMNS) {
      if (!(label in row)) continue;
      const sheetText = row[label] || "";
      const base = snap ? cellString(snap[exportIndex.get(key)]) : cellString(cellFor(data, key));
      if (canonicalCell(key, sheetText) === canonicalCell(key, base)) continue;

      const dbNow = cellString(cellFor(data, key));
      if (canonicalCell(key, dbNow) !== canonicalCell(key, base)) conflicts.push(key);
      applyCell(data, key, sheetText);
      changes[key] = { from: dbNow, to: sheetText };
    }

    if (!Object.keys(changes).length) { summary.unchanged++; continue; }

    stampParts(data, Object.keys(changes), now);
    await query("UPDATE properties SET data = $2::jsonb, updated_at = now() WHERE id = $1", [id, JSON.stringify(data)]);
    await logAudit({
      propertyId: id,
      actorEmail: actor,
      actorRole: "sheet",
      action: "sheet_edit",
      changes: { fields: changes, conflicts },
    });
    summary.updated++;
    if (conflicts.length) summary.conflicts++;
  }

  return summary;
}
