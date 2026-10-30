/**
 * brain-observatory.gs — nightly census + self-mirror for the Claude Brain.
 *
 * Runs inside Google Apps Script (script.google.com) on Joshua's account, so it
 * needs no server, no install, and no credentials beyond the one-time OAuth
 * consent on first run. It overwrites three fixed Drive files every night:
 *
 *   observatory-brief.json  (~3 KB)  Claude's daily read: totals, lane truth,
 *                                    INBOX on disk split fresh/aged, genuinely
 *                                    untagged docs, 14-day cadence, newest root
 *                                    MAP age, material changes since last night.
 *   mirror-self.md          (~20 KB) Who we have been: MOMENT + SELF-MODEL with
 *                                    a 300-char excerpt each; DECISIONS + META
 *                                    titles only. Chronological, read whole.
 *   observatory-data.json   (large)  Every doc: id, lane, date, summary, tags.
 *                                    Feeds any atlas / mirror build later.
 *
 * It appends an [OBSERVATORY] Brain doc ONLY on a material change (corpus
 * +15 in 24h, a new lane, a lane crossing 25 or 50, the MOMENT lane growing).
 * Quiet nights write nothing to the Brain. Overwriting the three JSON/MD files
 * does not break append-only: that rule governs knowledge, not a regenerated
 * render.
 *
 * INSTALL (one time, ~3 minutes):
 *   1. https://script.google.com/home  →  New project
 *   2. Replace the default Code.gs contents with this whole file. Save.
 *   3. Project Settings (gear) → check "Show appsscript.json", set
 *      "timeZone": "America/Chicago" (optional; the trigger carries its own).
 *   4. In the function dropdown pick  installObservatory  → Run.
 *      Approve the Drive + Docs permissions when asked. First scan runs now.
 *   5. Done when: the Execution log ends with "OBSERVATORY OK" and
 *      observatory-brief.json in the Brain folder no longer says SEED.
 *
 * The three target files were pre-created on 2026-10-30 so their IDs are fixed
 * and the MAP / profile can reference them by ID instead of by title search.
 *
 * UPDATING: paste the new file over Code.gs, save, run installObservatory again
 * (it replaces the trigger and re-scans). v2 2026-10-30: runs 2:30 AM CT so the
 * 3:09 AM sleep cycle reads tonight's census, not yesterday's; ZZ-SUPERSEDED /
 * STRUCTURAL lanes; INBOX fresh/aged split; untagged list in the brief.
 */

var CONFIG = {
  FOLDER_ID: '1zFTLpUzFbY_kWTL8afU5f3KhmaqU-BFn',       // Claude Brain
  BRIEF_FILE_ID: '1rP3niqTY1RU7TILKimogE4_xS4mjjcv3',    // observatory-brief.json
  MIRROR_FILE_ID: '1HUAQZYKFZZEtXN-Ud8LwWOd9zRXDnA1e',   // mirror-self.md
  DATA_FILE_ID: '1I3CfCXC54SkxyW49PF1zD6c6ztVbt4RL',     // observatory-data.json
  TIMEZONE: 'America/Chicago',
  RUN_HOUR: 2,                                            // 2:30 AM CT, BEFORE the 3:09 AM sleep cycle reads the brief
  INBOX_FRESH_DAYS: 14,                                   // INBOX younger than this counts as "fresh"
  PROSE_LANES: ['MOMENT', 'SELF-MODEL'],                  // get an excerpt
  TITLE_LANES: ['DECISION', 'DECISIONS', 'DECISION-PENDING', 'META'], // titles only
  EXCERPT_CHARS: 300,
  BODY_FETCH_BUDGET_MS: 240000,                           // stay well inside the 6-min limit
  MATERIAL: { corpusDelta24h: 15, laneThresholds: [25, 50] }
};

// ---------------------------------------------------------------- entry points

/** Run once by hand. Installs the nightly trigger and does the first scan. */
function installObservatory() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runObservatory') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runObservatory')
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.RUN_HOUR)
    .nearMinute(30)
    .inTimezone(CONFIG.TIMEZONE)
    .create();
  Logger.log('Trigger installed: runObservatory daily ~%s:30 %s', CONFIG.RUN_HOUR, CONFIG.TIMEZONE);
  runObservatory();
}

/** The nightly job. Safe to run by hand at any time. */
function runObservatory() {
  var started = Date.now();
  var docs = scanFolder_();
  var prev = readJson_(CONFIG.BRIEF_FILE_ID);
  var brief = buildBrief_(docs, prev);

  writeFile_(CONFIG.DATA_FILE_ID, JSON.stringify({
    generatedAt: brief.generatedAt,
    count: docs.length,
    docs: docs
  }));
  writeFile_(CONFIG.BRIEF_FILE_ID, JSON.stringify(brief, null, 2));
  writeFile_(CONFIG.MIRROR_FILE_ID, buildMirror_(docs, started));

  if (brief.materialChanges.length) writeObservatoryDoc_(brief);

  Logger.log('OBSERVATORY OK — %s docs, %s lanes, %s new in 24h, %s material change(s), %ss',
    docs.length, Object.keys(brief.lanes).length, brief.totals.last24h,
    brief.materialChanges.length, Math.round((Date.now() - started) / 1000));
}

/** Quick health check: when did it last run, and is the trigger alive? */
function showStatus() {
  var brief = readJson_(CONFIG.BRIEF_FILE_ID);
  var triggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'runObservatory';
  });
  Logger.log('brief.status=%s generatedAt=%s triggers=%s',
    brief && brief.status, brief && brief.generatedAt, triggers.length);
}

// ---------------------------------------------------------------- scanning

function scanFolder_() {
  var it = DriveApp.getFolderById(CONFIG.FOLDER_ID).getFiles();
  var out = [];
  while (it.hasNext()) {
    var f = it.next();
    var title = f.getName();
    var p = parseTitle_(title);
    out.push({
      id: f.getId(),
      title: title,
      lane: p.lane,
      date: p.date,
      summary: p.summary,
      tags: p.tags,
      mime: f.getMimeType(),
      created: f.getDateCreated().toISOString(),
      modified: f.getLastUpdated().toISOString()
    });
  }
  out.sort(function (a, b) {
    var ka = (a.date || a.created.slice(0, 10)) + a.created;
    var kb = (b.date || b.created.slice(0, 10)) + b.created;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return out;
}

/**
 * Title convention: "[TYPE] YYYY-MM-DD — summary | tags: a, b, c"
 * Tolerates a plain hyphen for the dash, missing tags, and files with no lane.
 * Known un-bracketed families get their own lane so UNTAGGED means "really untagged":
 *   ZZ-SUPERSEDED ... / ZZ-ERROR ...  -> ZZ-SUPERSEDED / ZZ-ERROR (retired docs, housekeeping)
 *   "00 — BRAIN README", "01 — BRAIN SYSTEM STATE", CLAUDE-BRAIN-HANDOFF.md -> STRUCTURAL
 *   *.json / *.md / *.txt / *.csv -> FILE (the Observatory's own outputs)
 */
function parseTitle_(t) {
  var laneMatch = t.match(/^\[([A-Z][A-Z0-9-]*)\]/);
  var lane;
  if (laneMatch) lane = laneMatch[1];
  else if (/^ZZ-SUPERSEDED/i.test(t)) lane = 'ZZ-SUPERSEDED';
  else if (/^ZZ-/i.test(t)) lane = 'ZZ-ERROR';
  else if (/^0\d\s/.test(t) || /^CLAUDE-BRAIN-HANDOFF/i.test(t)) lane = 'STRUCTURAL';
  else if (/\.(json|md|txt|csv)$/i.test(t)) lane = 'FILE';
  else lane = 'UNTAGGED';
  var dateMatch = t.match(/(\d{4}-\d{2}-\d{2})/);
  var body = t.replace(/^\[[^\]]*\]\s*/, '').replace(/^\d{4}-\d{2}-\d{2}\s*[—–-]*\s*/, '');
  var parts = body.split(/\s*\|\s*tags?:\s*/i);
  var tags = parts[1]
    ? parts[1].split(/\s*,\s*/).map(function (s) { return s.trim(); }).filter(Boolean)
    : [];
  return { lane: lane, date: dateMatch ? dateMatch[1] : null, summary: parts[0].trim(), tags: tags };
}

// ---------------------------------------------------------------- the brief

function buildBrief_(docs, prev) {
  var now = new Date();
  var dayMs = 86400000;

  var lanes = {};
  docs.forEach(function (d) { lanes[d.lane] = (lanes[d.lane] || 0) + 1; });

  var cadence = {};
  for (var i = 13; i >= 0; i--) cadence[isoDay_(new Date(now.getTime() - i * dayMs))] = 0;
  docs.forEach(function (d) {
    var day = d.created.slice(0, 10);
    if (day in cadence) cadence[day]++;
  });

  var last24 = docs.filter(function (d) {
    return new Date(d.created).getTime() > now.getTime() - dayMs;
  }).length;

  // INBOX is never deleted, so "open INBOX" as a running tally drifts. Report what is
  // on disk, split by age: fresh (still worth triaging) vs aged (left in place).
  var inboxDocs = docs.filter(function (d) { return d.lane === 'INBOX'; });
  var freshCutoff = now.getTime() - CONFIG.INBOX_FRESH_DAYS * dayMs;
  var inboxFresh = inboxDocs.filter(function (d) { return new Date(d.created).getTime() > freshCutoff; }).length;

  // Genuinely untagged docs are rare; list them so a session can see what they are.
  var untaggedList = docs.filter(function (d) { return d.lane === 'UNTAGGED'; })
    .slice(0, 20)
    .map(function (d) { return { id: d.id, title: d.title.slice(0, 100), created: d.created.slice(0, 10) }; });

  var rootMaps = docs.filter(function (d) {
    return d.lane === 'MAP' && /root/i.test(d.title);
  }).sort(function (a, b) { return a.created < b.created ? 1 : -1; });
  var newestRoot = rootMaps[0] || null;
  var newestRootInfo = null;
  var docsSinceRoot = null;
  if (newestRoot) {
    newestRootInfo = {
      id: newestRoot.id,
      date: newestRoot.date,
      ageDays: Math.round((now.getTime() - new Date(newestRoot.created).getTime()) / dayMs * 10) / 10
    };
    docsSinceRoot = docs.filter(function (d) { return d.created > newestRoot.created; }).length;
  }

  var changes = [];
  if (last24 >= CONFIG.MATERIAL.corpusDelta24h) changes.push('corpus +' + last24 + ' in 24h');
  var prevLanes = prev && prev.lanes && typeof prev.lanes === 'object' ? prev.lanes : null;
  if (prevLanes) {
    Object.keys(lanes).forEach(function (l) {
      if (!(l in prevLanes)) {
        changes.push('new lane ' + l + ' (' + lanes[l] + ')');
        return;
      }
      CONFIG.MATERIAL.laneThresholds.forEach(function (th) {
        if (prevLanes[l] < th && lanes[l] >= th) changes.push(l + ' crossed ' + th + ' (' + lanes[l] + ')');
      });
    });
    if ((lanes.MOMENT || 0) > (prevLanes.MOMENT || 0)) changes.push('MOMENT lane grew to ' + lanes.MOMENT);
  }

  return {
    status: 'LIVE',
    generatedAt: now.toISOString(),
    previousGeneratedAt: prev && prev.generatedAt ? prev.generatedAt : null,
    totals: {
      docs: docs.length,
      lanes: Object.keys(lanes).length,
      last24h: last24,
      inboxOnDisk: inboxDocs.length,
      inboxFresh: inboxFresh,
      inboxFreshDays: CONFIG.INBOX_FRESH_DAYS,
      inboxAged: inboxDocs.length - inboxFresh,
      untagged: lanes.UNTAGGED || 0,
      retired: (lanes['ZZ-SUPERSEDED'] || 0) + (lanes['ZZ-ERROR'] || 0)
    },
    untaggedDocs: untaggedList,
    lanes: lanes,
    cadence14d: cadence,
    newestRootMap: newestRootInfo,
    docsSinceRootMap: docsSinceRoot,
    materialChanges: changes,
    files: {
      brief: CONFIG.BRIEF_FILE_ID,
      mirror: CONFIG.MIRROR_FILE_ID,
      data: CONFIG.DATA_FILE_ID
    },
    readMe: 'The MAP reports what it tracked; this brief reports what is on disk. When they disagree, this is right and the gap is the finding.'
  };
}

// ---------------------------------------------------------------- the mirror

function buildMirror_(docs, started) {
  var wanted = CONFIG.PROSE_LANES.concat(CONFIG.TITLE_LANES);
  var selected = docs.filter(function (d) { return wanted.indexOf(d.lane) >= 0; });
  var lines = [
    '# mirror-self.md',
    '',
    'Generated ' + new Date().toISOString() + ' by brain-observatory.gs. ' +
    'Who we have been: ' + CONFIG.PROSE_LANES.join(' + ') + ' with an excerpt; ' +
    CONFIG.TITLE_LANES.join(', ') + ' as titles only (titles state conclusions). ' +
    'Chronological, oldest first. ' + selected.length + ' entries.',
    ''
  ];
  var skipped = 0;
  selected.forEach(function (d) {
    lines.push('- ' + (d.date || d.created.slice(0, 10)) + ' [' + d.lane + '] ' + d.summary + ' (id:' + d.id + ')');
    if (CONFIG.PROSE_LANES.indexOf(d.lane) >= 0) {
      if (Date.now() - started < CONFIG.BODY_FETCH_BUDGET_MS) {
        var ex = excerpt_(d);
        if (ex) lines.push('  > ' + ex);
      } else {
        skipped++;
      }
    }
  });
  if (skipped) lines.push('', '_' + skipped + ' excerpt(s) skipped: body-fetch time budget reached._');
  return lines.join('\n') + '\n';
}

function excerpt_(d) {
  try {
    if (d.mime !== MimeType.GOOGLE_DOCS) return '';
    var text = DocumentApp.openById(d.id).getBody().getText().replace(/\s+/g, ' ').trim();
    return text.length > CONFIG.EXCERPT_CHARS ? text.slice(0, CONFIG.EXCERPT_CHARS) + '…' : text;
  } catch (e) {
    return '(excerpt unavailable: ' + e.message + ')';
  }
}

// ---------------------------------------------------------------- signal doc

function writeObservatoryDoc_(brief) {
  var day = brief.generatedAt.slice(0, 10);
  var title = '[OBSERVATORY] ' + day + ' — ' + brief.materialChanges.join('; ') +
    ' | tags: observatory, census, drift, volatile';
  var body = [
    'VOLATILE: yes (census snapshot; the numbers rot, the method does not).',
    '',
    'Written by brain-observatory.gs because something material changed since the previous night. Quiet nights write nothing.',
    '',
    'MATERIAL CHANGES:',
    brief.materialChanges.map(function (c) { return '- ' + c; }).join('\n'),
    '',
    'TOTALS: ' + JSON.stringify(brief.totals),
    'LANES: ' + JSON.stringify(brief.lanes),
    'NEWEST ROOT MAP: ' + JSON.stringify(brief.newestRootMap) + ' — docs since it: ' + brief.docsSinceRootMap,
    '',
    'Brief: https://drive.google.com/file/d/' + CONFIG.BRIEF_FILE_ID + '/view',
    'Mirror: https://drive.google.com/file/d/' + CONFIG.MIRROR_FILE_ID + '/view'
  ].join('\n');
  var doc = DocumentApp.create(title);
  doc.getBody().setText(body);
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(DriveApp.getFolderById(CONFIG.FOLDER_ID));
}

// ---------------------------------------------------------------- helpers

function readJson_(fileId) {
  try {
    return JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8'));
  } catch (e) {
    return null;
  }
}

function writeFile_(fileId, text) {
  DriveApp.getFileById(fileId).setContent(text);
}

function isoDay_(d) {
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}
