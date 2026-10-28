import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { query } from "../../../../lib/db";
import { sheetsConfigured, SHEET_TAB } from "../../../../lib/sheets";
import { pullFromSheet } from "../../../../lib/sheetPull";
import { pushToSheet } from "../../../../lib/sheetSync";

function secretMatches(given) {
  const expected = process.env.SHEET_SYNC_SECRET || "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Pulls sheet edits into the database, then pushes the result back to the sheet.
// Called by the Apps Script trigger (apps-script/SheetSync.gs) with the shared
// secret, or by a signed-in user.
// Body: { tab?: string, editor?: string }
// A tab other than "App Data" is an import (admins only), and only into an empty database.
export async function POST(req) {
  const session = await getServerSession(authOptions);
  const viaSecret = secretMatches(req.headers.get("x-sync-secret"));
  if (!session && !viaSecret) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!sheetsConfigured()) {
    return NextResponse.json({ error: "Google Sheet sync isn't configured.", code: "NOT_CONFIGURED" }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tab = body.tab || SHEET_TAB;
    const editor = body.editor || session?.user?.email || null;

    if (tab !== SHEET_TAB) {
      if (!session || session.user?.role !== "admin") {
        return NextResponse.json({ error: "Only admins can import from another tab." }, { status: 403 });
      }
      const count = await query("SELECT count(*)::int AS n FROM properties");
      if (count.rows[0].n > 0) {
        return NextResponse.json(
          { error: "The database already has properties. Import only into an empty database." },
          { status: 409 }
        );
      }
    }

    const summary = await pullFromSheet({ tab, editor });
    if (!summary.missingTab && (summary.created || summary.updated || tab !== SHEET_TAB)) {
      await pushToSheet();
    }
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
