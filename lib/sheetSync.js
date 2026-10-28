import { query, rowToProperty } from "./db";
import { exportPropertiesToSheet, sheetsConfigured } from "./sheets";
import { saveSnapshots } from "./sheetSnapshot";
import { pullFromSheet } from "./sheetPull";

// Writes the database to the App Data tab and records what the sheet now holds.
export async function pushToSheet() {
  const res = await query("SELECT id, data, created_at, updated_at FROM properties ORDER BY created_at ASC");
  const properties = res.rows.map(rowToProperty);
  const { rows } = await exportPropertiesToSheet(properties);
  await saveSnapshots(rows.slice(1));
  return { count: properties.length };
}

// Runs after every app save. Pull first, so edits a teammate made in the sheet
// since the last sync are kept, then push. If the pull fails, the push is skipped,
// so a failed read can't overwrite the sheet. Failures are logged and never fail the save.
export async function syncSheet() {
  if (!sheetsConfigured()) return;
  try {
    await pullFromSheet({ editor: null });
  } catch (err) {
    console.error("Google Sheet pull failed:", err.message);
    return;
  }
  try {
    await pushToSheet();
  } catch (err) {
    console.error("Google Sheet push failed:", err.message);
  }
}
