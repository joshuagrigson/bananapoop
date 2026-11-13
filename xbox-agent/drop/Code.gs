// Xbox agent -> Google Drive drop. Paste into a new Apps Script project (script.google.com),
// set DROP_KEY below to the same value as the GitHub secret DRIVE_DROP_KEY,
// Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone > Deploy.
// The /exec URL it gives you is the GitHub secret DRIVE_DROP_URL.
// It only accepts requests carrying DROP_KEY, and only writes under My Drive/<folder>.

const DROP_KEY = 'PASTE_THE_SAME_KEY_AS_THE_GITHUB_SECRET';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.key !== DROP_KEY) return out({ ok: false, error: 'bad key' });
    const folder = folderPath(body.folder || 'TheGamerzFeed/Xbox clips');
    const name = String(body.name || 'clip.mp4').replace(/[\\/]/g, '-');
    if (folder.getFilesByName(name).hasNext()) {
      const f = folder.getFilesByName(name).next();
      return out({ ok: true, url: f.getUrl(), folderUrl: folder.getUrl(), duplicate: true });
    }
    const blob = Utilities.newBlob(Utilities.base64Decode(body.b64), body.mime || 'video/mp4', name);
    const f = folder.createFile(blob);
    return out({ ok: true, url: f.getUrl(), folderUrl: folder.getUrl() });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function folderPath(path) {
  let f = DriveApp.getRootFolder();
  for (const part of path.split('/').filter(String)) {
    const it = f.getFoldersByName(part);
    f = it.hasNext() ? it.next() : f.createFolder(part);
  }
  return f;
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
