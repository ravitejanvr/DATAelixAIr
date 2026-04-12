# FEATURE SPEC


## Name:

(e.g., Canonical Fever Mapping)


## Purpose:

What problem does this solve?


## Inputs:

- raw input
- canonical inputs


## Outputs:

- expected structured output


## Dependencies:

- canonical layer
- reasoning engine


## Contracts Affected:

- Canonical Contract
- Pipeline Contract


## Logic:

Step-by-step flow


## Edge Cases:

- missing input
- ambiguous mapping


## Failure Modes:

- incorrect mapping
- partial mapping


## Test Cases:

1. Input: "fever"
   Output: FEVER_ID

2. Input: "high temperature"
   Output: FEVER_ID


## Trace Expectations:

- canonical_id present
- no raw strings