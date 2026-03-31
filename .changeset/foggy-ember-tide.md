---
"create-cf-token": patch
---

Add CI pipeline with typecheck, lint, build, and security audit steps.

Add missing package.json metadata: `author`, `homepage`, `bugs`, and `sideEffects: false`. Fix `repository.url` to use the correct `git+https` prefix.

Update `publish-preview.yml` to post a custom PR comment with an "Open in StackBlitz" button that opens in a new browser tab (`target="_blank"`).
