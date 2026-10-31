import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { serviceAccount, sheetId, sheetsConfigured, readTab, SHEET_TAB } from "../../../../lib/sheets";

// Admin-only check of the Google Sheet connection. Reports yes/no checks and the
// Google error text. Never returns the key, the secret, or the sheet's contents.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
  let parses = false;
  let parseError = null;
  let hasEmail = false;
  let hasKey = false;
  if (raw) {
    try {
      const creds = JSON.parse(raw);
      parses = true;
      hasEmail = !!creds.client_email;
      hasKey = !!creds.private_key;
    } catch (err) {
      parseError = err.message;
    }
  }

  const checks = {
    GOOGLE_SERVICE_ACCOUNT_JSON_set: !!raw,
    GOOGLE_SERVICE_ACCOUNT_JSON_parses: parses,
    GOOGLE_SERVICE_ACCOUNT_JSON_has_client_email: hasEmail,
    GOOGLE_SERVICE_ACCOUNT_JSON_has_private_key: hasKey,
    SHEET_ID_set: !!sheetId(),
    SHEET_SYNC_SECRET_set: !!process.env.SHEET_SYNC_SECRET,
    sheetsConfigured: sheetsConfigured(),
  };

  let sheetCheck = null;
  if (sheetsConfigured()) {
    try {
      const tab = await readTab(SHEET_TAB);
      sheetCheck = { appDataTabExists: tab !== null, rowsInAppData: tab ? tab.rows.length : 0 };
    } catch (err) {
      sheetCheck = { error: err.message };
    }
  }

  return NextResponse.json({
    checks,
    parseError,
    serviceAccountLooksLikeEmail: serviceAccount() ? !!serviceAccount().client_email : false,
    sheetCheck,
  });
}
