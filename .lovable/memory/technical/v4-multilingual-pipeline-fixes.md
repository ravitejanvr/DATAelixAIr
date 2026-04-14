---
name: V4 Multilingual Pipeline Fixes
description: Language lock re-evaluation, ElevenLabs-only TTS routing, Unicode-safe intent classification, and LLM translation gate
type: feature
---

## Fixes Applied (2026-04-14)

### 1. Language Lock Re-evaluation
- `lockSessionLanguage()` in `index.ts` now allows switching FROM English TO Indic languages
- Detects Unicode script (Devanagari/Telugu/Tamil) to override English lock
- Still locks on first detection, but re-evaluates on script mismatch

### 2. TTS Routing — ElevenLabs Only
- Removed browser Web Speech API (`playNativeTTS`, `WEB_SPEECH_LANG_MAP`) from `ClinicalInteraction.tsx`
- ALL languages (Telugu, Hindi, Tamil, English) route through ElevenLabs Multilingual v2
- Voice ID: Sarah (`EXAVITQu4vr4xnSDxMaL`) supports all target languages natively

### 3. Unicode-Safe Intent Classification
- Replaced `\b` word boundaries with `(?:^|\s)` and `(?:\s|$)` in `intent_classifier.ts`
- Fixes: `లేదు` (Telugu "no") was misclassified as SYMPTOM_INPUT due to `\b` failure on non-Latin scripts

### 4. LLM Acknowledgment Translation Gate
- `executeAction()` now validates LLM acknowledgments via `assertNoEnglishFallback()`
- Falls back to localized `getAcknowledgment(lang)` if English is detected in non-English session
