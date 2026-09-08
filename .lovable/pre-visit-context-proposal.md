# Pre-visit Patient Context — design proposal

Goal: by the time the patient sits down, the doctor already sees a complete, structured,
source-attributed context — not a blank consultation.

Existing assets (reuse, do not rebuild): `PatientSelfIntake`, `conversation_engine` (voice/text intake agent),
`file_adapter` (report parsing), `context_engine` / CCO (`clinical_context/cco-client.ts`),
frozen Terminology v1.0 (`terminology_canonicalize`, `terminology_search`), episodic memory.

## 1. Collection channels (all write into one Pre-Visit Context record)
| Channel | Status | Work needed |
|---|---|---|
| Voice bot intake (phone/web, multilingual) | engine exists | run it pre-visit, not in-room; persist per visit |
| Structured self-intake form | exists | link output into same record |
| Uploaded reports / labs / discharge summaries | parser is a stub | real PDF + OCR extraction → canonical lab rows |
| Imaging report text (not pixels) | none | text extraction + canonical findings only |
| Wearables (steps, HR, HRV, SpO2, sleep, BP cuffs, CGM) | none | Google Fit / Apple Health / Fitbit import, or manual CSV first |
| Past visits at this clinic | exists (episodic memory) | surface in the pre-visit brief |

## 2. Contract
One `pre_visit_context` record per visit, canonical-only (no raw strings past ingestion):
- canonical features + provenance (channel, timestamp, confidence)
- vitals / labs / wearable trends as typed series, not text
- completeness score + list of unresolved gaps
- red flags raised during collection (routed to triage before the visit)
- everything is *proposed*, doctor confirms or rejects in one review step

## 3. Doctor-facing output: the Pre-Visit Brief
Ordered by the information hierarchy: summary → risks → context → data.
One screen, read in under 30 seconds, every line traceable to its source.

## 4. Sequencing
1. Persist pre-visit context per visit + brief UI (uses what already exists)
2. Real report/lab extraction (replaces the parser stub)
3. Wearable ingestion (start with manual/CSV + one provider)
4. Completeness-driven follow-up questions from the voice bot
5. Feed the brief into the unified pipeline as context, never as diagnosis

## 5. Guardrails
- Voice bot never diagnoses or advises; it collects and escalates red flags.
- Consent captured per channel; wearable data is opt-in and revocable.
- Wearable and patient-reported data enter reasoning as context evidence only,
  with lower weight than clinician-measured findings.
