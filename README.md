# Onboarding Tracker

StayVista's property onboarding tracker — acquisition through go-live and launch, built with Next.js, Postgres and the StayVista brand (Cambria/Larken + Inter, Warm Black / SV-Bloom / SV-Shine / SV-Sky).

## One-time setup after this is deployed on Vercel

### 1. Database (required)

The app needs a Postgres database to store properties.

1. Open the project on vercel.com → **Storage** tab → **Create Database** → **Postgres**.
2. Follow the prompts and connect it to this project. Vercel sets the `DATABASE_URL` (or `POSTGRES_URL`) environment variable automatically.
3. Redeploy (Vercel usually does this for you after linking storage).

Without this, the app loads but every save will show an error.

### 2. Google Sign-In (required)

Everyone must sign in with a Google account on **@stayvista.com** or **@stayvista.co.in** to use the app at all — there's no anonymous access, and the domain check happens in our own code, not just Google's consent screen.

1. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → OAuth consent screen**, configure an **External** consent screen (this is safe — access is still restricted to the two domains by app code, not by the consent screen's own audience setting). Add the app name and your support email.
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**, type **Web application**.
3. Under **Authorized redirect URIs**, add:
   `https://<your-vercel-domain>/api/auth/callback/google`
   (and `http://localhost:3000/api/auth/callback/google` too, if you'll run this locally).
4. In Vercel's project → **Settings → Environment Variables**, add:
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — from the OAuth client you just created.
   - `NEXTAUTH_SECRET` — any long random string, e.g. generate one with `openssl rand -base64 32`.
   - `NEXTAUTH_URL` — this app's own URL, e.g. `https://stayvista-onboarding-ledger-arya-4ee1.vercel.app`.
5. Redeploy.

**Until these four variables are set, nobody — including admins — can sign in or use the app.** Deploy this change and complete this setup in the same sitting.

### 3. Roles, edit locks and the audit trail

- **Admins** are a fixed list of email addresses in `lib/access.js` (`ADMIN_EMAILS`) — currently Gursimran Grewal, Rahul Anand and Neeraj Pant. To change who's an admin, edit that array and redeploy; there's no in-app UI for it by design.
- Everyone else who signs in with an allowed-domain account is an **Editor**.
- The form has three parts (Acquisition, Pre-onboarding, Launch). The moment any field in a part is first saved, that part starts a **24-hour clock**. Once 24 hours pass, Editors can no longer change that part's fields — only Admins can. Each part locks independently.
- **AGM notes are exempt** from this lock — anyone signed in can always add a note, at any time.
- Every create, edit, note, and delete is written to an **audit trail** (a separate `audit_log` table, created automatically on first use) recording who did it, their role, what changed, and when. It's visible per-property in the "Activity" panel at the bottom of each property's detail view.

### 4. Google Sheets two-way sync (optional)

The app keeps the **App Data** tab in a Google Sheet in step with the database, in both directions:

- **App → Sheet:** every save in the app rewrites the App Data tab.
- **Sheet → App:** an edit on the App Data tab is pulled into the app within seconds (Apps Script trigger), and a catch-up pull runs every 5 minutes.

Setup:

1. In Google Cloud Console, enable the **Google Sheets API** on the project and create a **Service Account** (IAM & Admin → Service Accounts). Create a JSON key and download it.
2. Share the Google Sheet with the service account's `client_email` as **Editor**.
3. In Vercel → **Settings → Environment Variables**, add:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` — the whole JSON key file, pasted as one value.
   - `SHEET_ID` — the ID from the sheet's URL.
   - `SHEET_SYNC_SECRET` — any long random string (e.g. `openssl rand -base64 32`).
4. Redeploy.
5. In the sheet: **Extensions → Apps Script**, paste `apps-script/SheetSync.gs`, add the two Script Properties it describes (`SYNC_URL`, `SYNC_SECRET`), and run `installTriggers()` once.

**Rules for sheet edits**

- Edit only on the **App Data** tab. The `Property ID` column identifies each row; don't change it.
- To add a property from the sheet, add a row with a blank `Property ID`. It is created in the app and gets its ID on the next sync.
- `Overall Status`, `Pre-Onboarding Complete` and `AGM Notes` are read-only in the sheet. Add AGM notes in the app.
- A sheet edit is **not** blocked by the 24-hour lock, but every sheet edit is recorded in the audit trail with its old and new values.
- Deleting a row in the sheet does not delete the property. Delete properties in the app.
- If the same cell is changed in both the app and the sheet between syncs, the sheet value wins. The audit entry lists it as a conflict.

**Importing an existing tab (one-time, admins):** `POST /api/sheet/pull` with body `{"tab": "Onboarding Tracker"}` loads rows from that tab into an empty database. It's refused if the database already has properties.

## Brand

Colors and type pairing come from StayVista's brand guidelines (`app/globals.css`):

| Token | Hex |
|---|---|
| Warm Black | `#1E1E1E` |
| Warm White | `#FAF7F2` |
| Cool White | `#FFFFFF` |
| SV-Bloom | `#E9A0A7` |
| SV-Shine | `#FDD5A9` |
| SV-Sky | `#9CCDFB` |

Headlines are set in the brand's headline serif, **Larken** — that's a licensed font, so this build falls back to **Cambria** (the same fallback the brand guideline itself lists) until Larken's font files are added. To use the real Larken: drop its `.woff2` files into `public/fonts/` and add an `@font-face` rule at the top of `app/globals.css` pointing `--font-display` at it. Body text and UI use **Inter**, loaded free from Google Fonts, exactly as the brand guideline specifies.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, GOOGLE_CLIENT_ID/SECRET, NEXTAUTH_SECRET/URL at minimum
npm run dev
```
