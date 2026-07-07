# First SNOMED CT Production Import — macOS Operator Guide

This is the step-by-step runbook for producing the **first** production SNOMED CT International release using the frozen v1.0 pipeline. It assumes a fresh macOS machine and no prior setup.

Total time: **~60–90 minutes**, most of it waiting on the SNOMED download and preprocessing.

---

## 0. Prerequisites (one-time)

You need:

- A macOS machine with ~5 GB free disk.
- A SNOMED International account with a valid affiliate license for the **International Edition** (register at https://mlds.ihtsdotools.org).
- **Platform admin** access to the DATAelixAIr app (your Supabase user must have the `platform_admin` role).
- The Lovable project's Git URL (available from **Lovable → Project → GitHub** — click "Connect to GitHub" if not yet linked, then copy the repo URL).

Install the base toolchain if you don't already have it:

```bash
# Xcode Command Line Tools (git, clang)
xcode-select --install

# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js via nvm (pinned to Node 22, matching the sandbox)
brew install nvm
mkdir -p ~/.nvm
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "$(brew --prefix nvm)/nvm.sh" ] && \. "$(brew --prefix nvm)/nvm.sh"' >> ~/.zshrc
source ~/.zshrc

nvm install 22
nvm use 22
node -v   # -> v22.x
```

---

## 1. Clone the repository

```bash
mkdir -p ~/code && cd ~/code
git clone <your-lovable-repo-url> dataelixair
cd dataelixair
```

You do **not** need to `npm install` — the preprocessing script uses only Node's built-in modules (`node:fs`, `node:zlib`, `node:stream`, `node:readline`, `node:crypto`). No dev server needs to run on your laptop.

Verify the script is present:

```bash
ls -l scripts/snomed-preprocess.mjs
```

---

## 2. Download the SNOMED CT International release

1. Sign in at https://mlds.ihtsdotools.org.
2. Go to **Release Packages → SNOMED CT International Edition**.
3. Download the most recent **RF2 Production** ZIP, e.g. `SnomedCT_InternationalRF2_PRODUCTION_20260701T120000Z.zip` (~200 MB).
4. Unzip it:

```bash
cd ~/Downloads
unzip SnomedCT_InternationalRF2_PRODUCTION_*.zip -d ~/snomed-release
```

You should now have a directory like `~/snomed-release/SnomedCT_InternationalRF2_PRODUCTION_20260701T120000Z/` containing `Snapshot/`, `Full/`, `Delta/` subfolders. The script reads the `Snapshot/` tree only.

---

## 3. Run the preprocessor

From the repo root:

```bash
cd ~/code/dataelixair

node scripts/snomed-preprocess.mjs \
  ~/snomed-release/SnomedCT_InternationalRF2_PRODUCTION_20260701T120000Z \
  ~/snomed-out/snomed-20260701 \
  SnomedCT_INT_20260701
```

Arguments:
1. Unzipped RF2 release directory.
2. Output directory (created if missing).
3. Release identifier — becomes the `release_identifier` recorded in the platform. Use `SnomedCT_INT_<YYYYMMDD>`.

Expected output: ~40 gzipped NDJSON chunks (~150 000 rows each) plus a `manifest.json`. Runtime: **5–15 minutes** depending on your Mac. Memory stays under ~200 MB (streamed).

Verify:

```bash
ls ~/snomed-out/snomed-20260701 | head
cat ~/snomed-out/snomed-20260701/manifest.json | head -40
```

The manifest must list chunks for all three target tables: `snomed_concepts`, `snomed_descriptions`, `snomed_relationships`.

---

## 4. Upload chunks to the `ontology` bucket

The `ontology` bucket is **private** — upload it from your authenticated admin session in the app, not with a public URL.

Easiest path (browser):

1. Open the app, sign in as a platform admin.
2. Open the browser devtools console on any page and paste:

```js
// Upload every file in the chunk directory to ontology/snomed/<release-id>/
// Paste this once; then trigger it per file using the <input type="file"> pattern below.
```

Or use the Supabase CLI (recommended for bulk):

```bash
brew install supabase/tap/supabase

# One-time login (opens browser)
supabase login

# Link to the project (Lovable → Project → Backend shows the project ref; do NOT commit this).
supabase link --project-ref <project-ref>

# Bulk upload all chunks + manifest
cd ~/snomed-out/snomed-20260701
for f in *.ndjson.gz manifest.json; do
  supabase storage cp "$f" "ss:///ontology/snomed/SnomedCT_INT_20260701/$f"
done
```

Expected: ~40 uploads, each 5–20 MB, total upload ~2–5 minutes on a typical connection.

Verify in the Supabase dashboard: **Storage → ontology → snomed/SnomedCT_INT_20260701/** should list every chunk plus `manifest.json`.

---

## 5. Register the release, load, verify, promote

Back in the app (**Terminology Administration**, `/platform-admin/terminology`):

1. **Register new release** — paste the full contents of `manifest.json` into the textarea, click **Create release + seed queue**. This inserts one queue row per chunk.
2. **Loading** — `pg_cron` drains the queue automatically at 30 s intervals. Progress bars update every 5 s. Full International load takes **~40 minutes** unattended, or you can click **Load next chunk** repeatedly to accelerate.
3. **Verify** — once all chunks show `done` (green), click **Verify** on the release. All checks must pass (orphan relationships = 0, duplicates = 0, broken hierarchy = 0, search-index shortfall = 0).
4. **Promote to active** — click **Promote to active**. This atomically swaps the code system's `active_release_id`, rebuilds the search index, and updates row counts.
5. **Smoke test** — in the Search verification panel, search `pneumonia`. You should see clinically sensible SNOMED hits within ~200 ms.

---

## 6. Freeze the terminology subsystem

Once the release is live and verified:

- Do not open PRs against `supabase/functions/terminology-*`, `supabase/migrations/*terminology*`, `scripts/snomed-*`, or `src/pages/TerminologyAdmin.tsx` unless the change is a documented bug fix.
- All new engineering effort moves to the Clinical Reasoning Engine, Bayesian differential diagnosis, guideline integration, and AI orchestration.
- Future SNOMED releases repeat steps 2–5 with a new release identifier. Nothing about the pipeline changes.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Detected RF2 snapshot files: concept: (missing)` | Pointed at the outer ZIP folder instead of the release directory containing `Snapshot/`. | Re-run with the directory that has `Snapshot/` inside it. |
| Preprocessor uses > 2 GB RAM | Wrong Node version (< 18 lacks `readline` streaming perf fixes). | `nvm use 22` and retry. |
| `permission denied` on Storage upload | Not signed in as `platform_admin`, or wrong bucket name. | Confirm role in `user_roles`, use bucket `ontology`. |
| Chunk stays `queued` forever | `pg_cron` job not running. | Check **Backend → Jobs** for `terminology-load-chunk-30s`; click **Load next chunk** manually as a workaround. |
| Verify reports `search_index_shortfall > 0` | Promotion didn't finish rebuilding the search index. | Re-run **Promote** — it's idempotent. |
| Verify reports `orphan_relationships > 0` | A description or relationship references a concept not in this release. | Re-download the RF2 ZIP (partial download) and re-run from step 2. |

---

## What to hand off to the next operator

After a successful import, record in the release notes:

- Release identifier (e.g. `SnomedCT_INT_20260701`)
- Effective date
- Row counts (from the release card)
- Verification JSON (from clicking **Verify**)
- Time spent at each stage

This becomes the baseline for the next release cycle.
