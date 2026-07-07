#!/usr/bin/env node
// Generate a synthetic SNOMED CT RF2 Snapshot fixture directory that the
// production preprocessor (`snomed-preprocess.mjs`) can consume unchanged.
//
// Usage:
//   node scripts/snomed-synth-fixture.mjs ./tmp/snomed-synth
//   node scripts/snomed-preprocess.mjs   ./tmp/snomed-synth ./tmp/out SnomedCT_TEST_20250101
//
// The generated dataset mirrors the one exercised by the
// `terminology-e2e-test` edge function (Clinical finding -> Disease ->
// Infectious disease -> Pneumonia + Community-acquired / Viral subtypes,
// Gastroenteritis, Diabetes, Pain -> Headache).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , outDir = './tmp/snomed-synth'] = process.argv;
mkdirSync(outDir, { recursive: true });

const CONCEPT_HEADER  = 'id\teffectiveTime\tactive\tmoduleId\tdefinitionStatusId';
const DESC_HEADER     = 'id\teffectiveTime\tactive\tmoduleId\tconceptId\tlanguageCode\ttypeId\tterm\tcaseSignificanceId';
const REL_HEADER      = 'id\teffectiveTime\tactive\tmoduleId\tsourceId\tdestinationId\trelationshipGroup\ttypeId\tcharacteristicTypeId\tmodifierId';

const FSN = '900000000000003001';
const SYN = '900000000000013009';
const IS_A = '116680003';
const MODULE = '900000000000207008';
const DEFSTAT = '900000000000074008';
const CS_INSENSITIVE = '900000000000448009';
const STATED = '900000000000010007';
const MOD_EXISTENTIAL = '900000000000451002';
const ET = '20250101';

const concepts = [
  [404684003, 1], [64572001, 1], [40733004, 1], [233604007, 1],
  [385093006, 1], [233607000, 1], [25374005, 1], [73211009, 1],
  [22253000, 1], [25064002, 1],
  [111111111, 0], // inactive — must be filtered
];
const descriptions = [
  [1,  1, 404684003, FSN, 'Clinical finding (finding)'],
  [2,  1, 64572001,  FSN, 'Disease (disorder)'],
  [3,  1, 40733004,  FSN, 'Infectious disease (disorder)'],
  [4,  1, 233604007, FSN, 'Pneumonia (disorder)'],
  [5,  1, 385093006, FSN, 'Community-acquired pneumonia (disorder)'],
  [6,  1, 233607000, FSN, 'Viral pneumonia (disorder)'],
  [7,  1, 25374005,  FSN, 'Gastroenteritis (disorder)'],
  [8,  1, 73211009,  FSN, 'Diabetes mellitus (disorder)'],
  [9,  1, 22253000,  FSN, 'Pain (finding)'],
  [10, 1, 25064002,  FSN, 'Headache (finding)'],
  [20, 1, 233604007, SYN, 'Pneumonia'],
  [21, 1, 233604007, SYN, 'Lung infection'],
  [22, 1, 233607000, SYN, 'Viral chest infection'],
  [23, 1, 25064002,  SYN, 'Headache'],
  [24, 1, 25064002,  SYN, 'Cephalgia'],
  [25, 1, 73211009,  SYN, 'Diabetes'],
  [99, 0, 233604007, SYN, 'OLD_TERM_SHOULD_NOT_APPEAR'],
];
const rels = [
  [1001, 64572001, 404684003], [1002, 22253000,  404684003],
  [1003, 40733004, 64572001],  [1004, 73211009,  64572001],
  [1005, 233604007, 40733004], [1006, 25374005,  40733004],
  [1007, 385093006, 233604007],[1008, 233607000, 233604007],
  [1009, 25064002, 22253000],
];

const conceptLines = [CONCEPT_HEADER, ...concepts.map(([id, active]) =>
  [id, ET, active, MODULE, DEFSTAT].join('\t'))].join('\n');
const descLines = [DESC_HEADER, ...descriptions.map(([id, active, conceptId, typeId, term]) =>
  [id, ET, active, MODULE, conceptId, 'en', typeId, term, CS_INSENSITIVE].join('\t'))].join('\n');
const relLines = [REL_HEADER, ...rels.map(([id, src, dst]) =>
  [id, ET, 1, MODULE, src, dst, 0, IS_A, STATED, MOD_EXISTENTIAL].join('\t'))].join('\n');

writeFileSync(join(outDir, `sct2_Concept_Snapshot_TEST_${ET}.txt`), conceptLines + '\n');
writeFileSync(join(outDir, `sct2_Description_Snapshot-en_TEST_${ET}.txt`), descLines + '\n');
writeFileSync(join(outDir, `sct2_Relationship_Snapshot_TEST_${ET}.txt`), relLines + '\n');

console.log(`Synthetic RF2 fixture written to ${outDir}`);
console.log('Next: node scripts/snomed-preprocess.mjs', outDir, './tmp/out', `SnomedCT_TEST_${ET}`);
