---
"create-cf-token": patch
---

Replace regex-based permission service suffix parsing with deterministic string
matching to avoid remaining CodeQL ReDoS findings in permission grouping.
