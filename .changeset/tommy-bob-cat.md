---
"create-cf-token": patch
---

Add comprehensive e2e and unit test suite using Bun's built-in test runner. Tests cover pure functions (buildPolicies, groupByService, extractFailedPerm), error classes, all API functions via a real local HTTP fixture server (no fetch mocks), CLI flag subprocess tests (--help, --version), full CLI e2e subprocess tests with fixture server injection, and Node.js e2e tests against the built dist/cli.mjs. Also makes CF_API_BASE_URL overridable at runtime for test isolation.
