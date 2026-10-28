/**
 * Two-way sync between the "App Data" tab and the Onboarding Tracker app.
 *
 * SETUP (once, in the sheet: Extensions → Apps Script):
 *  1. Paste this file in, replacing anything there.
 *  2. Project Settings (gear icon) → Script Properties → add:
 *       SYNC_URL    = https://stayvista-onboarding-ledger.vercel.app/api/sheet/pull
 *       SYNC_SECRET = the value of SHEET_SYNC_SECRET set in Vercel
 *  3. Run installTriggers() once and approve the permissions.
 *
 * After that, any edit on the App Data tab is pulled into the app within seconds,
 * and every 5 minutes a catch-up pull runs in case an edit was missed.
 */

var SYNC_TAB = "App Data";

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === "onEditSync" || fn === "pollSync") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("onEditSync").forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger("pollSync").timeBased().everyMinutes(5).create();
}

function onEditSync(e) {
  if (e && e.range && e.range.getSheet().getName() !== SYNC_TAB) return;
  pullNow();
}

function pollSync() {
  pullNow();
}

function pullNow() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("SYNC_URL");
  var secret = props.getProperty("SYNC_SECRET");
  if (!url || !secret) return;

  var editor = "";
  try { editor = Session.getActiveUser().getEmail() || ""; } catch (err) {}

  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { "x-sync-secret": secret },
    payload: JSON.stringify({ tab: SYNC_TAB, editor: editor }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) {
    console.error("Sync failed: " + res.getResponseCode() + " " + res.getContentText());
  }
}
