---
"create-cf-token": patch
---

Security remediation: removed compromised repository setup hooks that could execute `node .github/setup.js` from editor/agent configuration and the package test script. The malicious setup payload has been deleted, the test script now only runs the Bun test suite, and CI now runs a security regression scan to prevent these auto-executing hooks from being reintroduced.
