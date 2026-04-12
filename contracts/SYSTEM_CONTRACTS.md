# SYSTEM CONTRACTS — DATAelixAIr V4


## 1. CANONICAL CONTRACT

- No raw strings allowed in reasoning layer
- All inputs must map to canonical IDs
- SNOMED → canonical → reasoning
- Any violation = system failure


## 2. PIPELINE CONTRACT

Input → Canonical → Context → Reasoning → Confidence → Authority → SSAL → UI

- No layer skipping
- No parallel scoring engines
- No duplicate logic


## 3. DETERMINISM CONTRACT

- Same input must produce same output
- No randomness in reasoning layer


## 4. EXPLAINABILITY CONTRACT

- Explanation must equal computation
- No post-hoc LLM explanations for reasoning


## 5. AUTHORITY CONTRACT

- SSAL is final output
- No modification after SSAL


## 6. VALIDATION CONTRACT

- UI output must equal benchmark output
- Every feature must have test cases


## 7. TRACEABILITY CONTRACT

Each run must log:

- canonical mapping
- activated states
- contributions
- final scores