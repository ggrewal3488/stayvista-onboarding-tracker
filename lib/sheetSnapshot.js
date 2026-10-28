import { query } from "./db";

// For each property, the exact row the app last wrote to the sheet. A pull
// compares the sheet with this to find what a teammate changed, so an app
// change that hasn't reached the sheet yet is never mistaken for a sheet edit.
let ready = false;
async function ensureTable() {
  if (ready) return;
  await query(`
    CREATE TABLE IF NOT EXISTS sheet_snapshot (
      property_id TEXT PRIMARY KEY,
      row JSONB NOT NULL,
      pushed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  ready = true;
}

export async function loadSnapshots() {
  await ensureTable();
  const res = await query("SELECT property_id, row FROM sheet_snapshot");
  return new Map(res.rows.map((r) => [r.property_id, r.row]));
}

// rows: arrays as written to the sheet, with the property ID in position 0.
export async function saveSnapshots(rows) {
  await ensureTable();
  const ids = rows.map((r) => r[0]);
  for (const r of rows) {
    await query(
      `INSERT INTO sheet_snapshot (property_id, row, pushed_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (property_id) DO UPDATE SET row = EXCLUDED.row, pushed_at = now()`,
      [r[0], JSON.stringify(r)]
    );
  }
  await query("DELETE FROM sheet_snapshot WHERE NOT (property_id = ANY($1::text[]))", [ids]);
}
