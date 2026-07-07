#!/usr/bin/env node
// SNOMED CT RF2 preprocessor.
//
// Reads Snapshot RF2 files from an unzipped release directory, filters to
// active rows (English descriptions only), and writes gzipped NDJSON chunks
// of ~150,000 rows each plus a manifest.json for the terminology loader.
//
// Usage:
//   node scripts/snomed-preprocess.mjs <rf2-dir> <out-dir> <release-identifier>
//
// Example:
//   node scripts/snomed-preprocess.mjs \
//     ./SnomedCT_InternationalRF2_PRODUCTION_20250701T120000Z \
//     ./out/snomed-20250701 \
//     SnomedCT_INT_20250701
//
// After running, upload the contents of <out-dir> to the `ontology` bucket
// under the path snomed/<release-identifier>/, then call the
// terminology-create-release edge function with the manifest.json body.

import { readdirSync, createReadStream, mkdirSync, writeFileSync, createWriteStream, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { join, basename } from 'node:path';
import { createInterface } from 'node:readline';

const CHUNK_ROWS = 150_000;

async function main() {
  const [, , rf2Dir, outDir, releaseId] = process.argv;
  if (!rf2Dir || !outDir || !releaseId) {
    console.error('Usage: node snomed-preprocess.mjs <rf2-dir> <out-dir> <release-identifier>');
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });

  const files = collectSnapshotFiles(rf2Dir);
  console.log('Detected RF2 snapshot files:');
  for (const [k, v] of Object.entries(files)) console.log(`  ${k}: ${v ?? '(missing)'}`);

  const manifest = {
    release_identifier: releaseId,
    effective_date: extractEffectiveDate(releaseId),
    generated_at: new Date().toISOString(),
    source_sha256: {},
    chunks: [],
  };

  if (files.concept) {
    manifest.source_sha256.concept = await sha256(files.concept);
    await processFile(files.concept, outDir, releaseId, 'snomed_concepts', parseConceptRow, manifest);
  }
  if (files.description) {
    manifest.source_sha256.description = await sha256(files.description);
    await processFile(files.description, outDir, releaseId, 'snomed_descriptions', parseDescriptionRow, manifest);
  }
  if (files.relationship) {
    manifest.source_sha256.relationship = await sha256(files.relationship);
    await processFile(files.relationship, outDir, releaseId, 'snomed_relationships', parseRelationshipRow, manifest);
  }

  const manifestPath = join(outDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('\n=== Done ===');
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Chunks:   ${manifest.chunks.length}`);
  console.log('\nNext steps:');
  console.log(`  1. Upload every *.ndjson.gz in ${outDir} to the "ontology" bucket at path snomed/${releaseId}/`);
  console.log(`  2. In the app: go to /platform-admin/terminology, paste manifest.json, click "Create release".`);
  console.log(`  3. pg_cron will drain the queue in ~5-10 minutes; then click "Promote" to activate.`);
}

function collectSnapshotFiles(dir) {
  const walk = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
    );
  const all = walk(dir);
  const find = (pat) => all.find((f) => new RegExp(pat, 'i').test(basename(f)));
  return {
    concept: find(`^sct2_Concept_Snapshot.*\\.txt$`),
    // Prefer English snapshot; fall back to any Description_Snapshot.
    description:
      find(`^sct2_Description_Snapshot-en.*\\.txt$`) ||
      find(`^sct2_Description_Snapshot.*\\.txt$`),
    relationship: find(`^sct2_Relationship_Snapshot.*\\.txt$`),
  };
}

function extractEffectiveDate(releaseId) {
  const m = /(\d{4})(\d{2})(\d{2})/.exec(releaseId);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

async function sha256(path) {
  const h = createHash('sha256');
  await pipeline(createReadStream(path), h);
  return h.digest('hex');
}

function parseConceptRow(cols, headers) {
  const g = (name) => cols[headers.indexOf(name)];
  if (g('active') !== '1') return null;
  return {
    concept_id: Number(g('id')),
    effective_time: rf2Date(g('effectiveTime')),
    active: true,
    module_id: g('moduleId'),
    definition_status_id: g('definitionStatusId'),
  };
}

function parseDescriptionRow(cols, headers) {
  const g = (name) => cols[headers.indexOf(name)];
  if (g('active') !== '1') return null;
  if (g('languageCode') !== 'en') return null;
  return {
    description_id: Number(g('id')),
    concept_id: Number(g('conceptId')),
    language_code: g('languageCode'),
    type_id: g('typeId'),
    term: g('term'),
    active: true,
  };
}

function parseRelationshipRow(cols, headers) {
  const g = (name) => cols[headers.indexOf(name)];
  if (g('active') !== '1') return null;
  return {
    relationship_id: Number(g('id')),
    source_concept: Number(g('sourceId')),
    destination_concept: Number(g('destinationId')),
    relationship_type: g('typeId'),
    active: true,
  };
}

function rf2Date(s) {
  if (!s || s.length < 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

async function processFile(path, outDir, releaseId, targetTable, parseRow, manifest) {
  console.log(`\nProcessing ${basename(path)} -> ${targetTable}`);
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let headers = null;
  let chunkIdx = 0;
  let rowsInChunk = 0;
  let totalRows = 0;
  let currentPath = null;
  let out = null;
  let gz = null;

  const openChunk = () => {
    const fname = `${targetTable}_${String(chunkIdx).padStart(4, '0')}.ndjson.gz`;
    currentPath = join(outDir, fname);
    out = createWriteStream(currentPath);
    gz = createGzip();
    gz.pipe(out);
    return fname;
  };

  const closeChunk = async (rows, fname) => {
    gz.end();
    await new Promise((r) => out.on('close', r));
    manifest.chunks.push({
      index: chunkIdx,
      target_table: targetTable,
      storage_path: `snomed/${releaseId}/${fname}`,
      expected_rows: rows,
      size_bytes: statSync(currentPath).size,
    });
  };

  let currentFname = openChunk();

  for await (const line of rl) {
    if (!headers) {
      headers = line.split('\t');
      continue;
    }
    const cols = line.split('\t');
    const row = parseRow(cols, headers);
    if (!row) continue;
    if (!gz.write(JSON.stringify(row) + '\n')) {
      await new Promise((r) => gz.once('drain', r));
    }
    rowsInChunk++;
    totalRows++;

    if (rowsInChunk >= CHUNK_ROWS) {
      await closeChunk(rowsInChunk, currentFname);
      chunkIdx++;
      rowsInChunk = 0;
      currentFname = openChunk();
    }
  }

  if (rowsInChunk > 0) {
    await closeChunk(rowsInChunk, currentFname);
  } else if (gz) {
    // Close empty trailing stream, don't record it.
    gz.end();
    await new Promise((r) => out.on('close', r));
  }
  console.log(`  ${totalRows.toLocaleString()} active rows -> ${manifest.chunks.filter((c) => c.target_table === targetTable).length} chunks`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
