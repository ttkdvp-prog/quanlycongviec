/**
 * Dashboard + Sheets Backend
 *
 * Deploy: Extensions → Apps Script → paste this file → Deploy → Web app
 * Script Properties required:
 *   API_KEY        long random string, must match VITE_API_KEY on the client
 *   SPREADSHEET_ID id of the spreadsheet (defaults to active spreadsheet)
 *
 * Convention per entity sheet:
 *   row 1 = headers; required columns: id, version, deleted (TRUE/FALSE)
 *   plus your domain columns (name, price, ...)
 * Hidden sheet `_meta` row 1 = ["lastVersion"], A2 holds the integer counter.
 */

const ENVELOPE_OK = (data, extra) => Object.assign({ ok: true, error: null, data: data }, extra || {});
const ENVELOPE_ERR = (msg) => ({ ok: false, error: String(msg), data: null });

function doGet(e) {
  return handle_(e, e.parameter || {});
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData && e.postData.contents || "{}"); } catch (err) {}
  const merged = Object.assign({}, e.parameter || {}, body);
  return handle_(e, merged);
}

function handle_(e, p) {
  try {
    requireApiKey_(e, p);
    const action = String(p.action || "list");
    switch (action) {
      case "list":   return json_(list_(p));
      case "get":    return json_(get_(p));
      case "create": return json_(create_(p));
      case "update": return json_(update_(p));
      case "delete": return json_(remove_(p));
      case "stream": return json_(stream_(p));
      default:       return json_(ENVELOPE_ERR("unknown action: " + action));
    }
  } catch (err) {
    return json_(ENVELOPE_ERR(err && err.message || err));
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function requireApiKey_(e, p) {
  const expected = PropertiesService.getScriptProperties().getProperty("API_KEY");
  if (!expected) throw new Error("API_KEY not set in Script Properties");
  const headerKey = e && e.parameter && e.parameter.apiKey;
  const bodyKey = p && p.apiKey;
  // Apps Script does not expose custom headers reliably; clients send apiKey in body or query.
  const provided = headerKey || bodyKey;
  if (provided !== expected) throw new Error("unauthorized");
}

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  const ss = ss_();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error("sheet not found: " + name);
  return sh;
}

function metaSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName("_meta");
  if (!sh) {
    sh = ss.insertSheet("_meta");
    sh.getRange("A1:B1").setValues([["lastVersion", "_"]]);
    sh.getRange("A2").setValue(0);
    sh.hideSheet();
  }
  return sh;
}

function bumpVersion_() {
  const sh = metaSheet_();
  const cell = sh.getRange("A2");
  const v = (Number(cell.getValue()) || 0) + 1;
  cell.setValue(v);
  return v;
}

function readVersion_() {
  return Number(metaSheet_().getRange("A2").getValue()) || 0;
}

function rows_(sheetName) {
  const sh = sheet_(sheetName);
  const values = sh.getDataRange().getValues();
  if (!values.length) return { headers: [], data: [], sh: sh };
  const headers = values[0].map(String);
  const data = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = r[j];
    obj.__row = i + 1; // 1-based with header
    data.push(obj);
  }
  return { headers: headers, data: data, sh: sh };
}

function list_(p) {
  const { headers, data } = rows_(p.table);
  let rows = data.filter(r => r.deleted !== true && String(r.deleted).toUpperCase() !== "TRUE");
  if (p.q) {
    const q = String(p.q).toLowerCase();
    rows = rows.filter(r => headers.some(h => String(r[h] || "").toLowerCase().indexOf(q) !== -1));
  }
  if (p.sort) {
    const [k, dir] = String(p.sort).split(":");
    rows.sort((a, b) => {
      if (a[k] === b[k]) return 0;
      const cmp = a[k] > b[k] ? 1 : -1;
      return dir === "desc" ? -cmp : cmp;
    });
  }
  const total = rows.length;
  const offset = Number(p.offset || 0);
  const limit = Math.min(Number(p.limit || 25), 500);
  const page = rows.slice(offset, offset + limit).map(stripMeta_);
  return ENVELOPE_OK(page, { total: total, version: readVersion_() });
}

function get_(p) {
  const { data } = rows_(p.table);
  const row = data.find(r => String(r.id) === String(p.id));
  return row ? ENVELOPE_OK(stripMeta_(row), { version: readVersion_() })
             : ENVELOPE_ERR("not found");
}

function create_(p) {
  const { headers, sh } = rows_(p.table);
  const v = bumpVersion_();
  const id = p.data && p.data.id || Utilities.getUuid();
  const now = new Date();
  const merged = Object.assign({}, p.data, {
    id: id,
    version: v,
    deleted: false,
    created_at: p.data && p.data.created_at || now,
    updated_at: now,
  });
  const row = headers.map(h => merged[h] != null ? merged[h] : "");
  sh.appendRow(row);
  return ENVELOPE_OK(merged, { version: v });
}

function update_(p) {
  const { headers, data, sh } = rows_(p.table);
  const target = data.find(r => String(r.id) === String(p.id));
  if (!target) return ENVELOPE_ERR("not found");
  const v = bumpVersion_();
  const merged = Object.assign({}, target, p.data, {
    version: v,
    updated_at: new Date(),
  });
  delete merged.__row;
  const row = headers.map(h => merged[h] != null ? merged[h] : "");
  sh.getRange(target.__row, 1, 1, headers.length).setValues([row]);
  return ENVELOPE_OK(merged, { version: v });
}

function remove_(p) {
  const { headers, data, sh } = rows_(p.table);
  const target = data.find(r => String(r.id) === String(p.id));
  if (!target) return ENVELOPE_ERR("not found");
  const v = bumpVersion_();
  const merged = Object.assign({}, target, {
    deleted: true,
    version: v,
    updated_at: new Date(),
  });
  delete merged.__row;
  const row = headers.map(h => merged[h] != null ? merged[h] : "");
  sh.getRange(target.__row, 1, 1, headers.length).setValues([row]);
  return ENVELOPE_OK({ id: target.id, deleted: true }, { version: v });
}

function stream_(p) {
  const since = Number(p.since || 0);
  const { data } = rows_(p.table);
  const changed = data
    .filter(r => Number(r.version) > since)
    .map(stripMeta_);
  return ENVELOPE_OK(changed, { version: readVersion_() });
}

function stripMeta_(row) {
  const out = Object.assign({}, row);
  delete out.__row;
  return out;
}
