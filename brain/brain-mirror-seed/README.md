# brain-mirror

Nightly, read-only copy of the Claude Brain (Google Drive folder
`1zFTLpUzFbY_kWTL8afU5f3KhmaqU-BFn`). One file per doc under `docs/`, named by
Drive ID. `INDEX.tsv` lists every doc with its lane, date and title.
`manifest.json` remembers what was mirrored so a night only re-exports what
changed.

Why it exists:

- A second copy of the Brain off Google.
- `git log` is the drift history: what appeared, what changed, when.
- `rg` over `docs/` is a deterministic full-text search, which Drive's title
  search is not.

It never writes to Drive and never deletes a mirrored file. A doc that vanishes
from Drive stays here with a `note: MISSING FROM DRIVE` line in its header.

Runs at 10:00 UTC daily via `.github/workflows/mirror.yml`, or by hand from the
Actions tab (tick "full" to re-export everything).

Setup, once: a Google service account with the Drive API enabled, the Brain
folder shared with its email as Viewer, and its JSON key stored as the repo
secret `GDRIVE_SA_KEY`.
