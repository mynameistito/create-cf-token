---
"create-cf-token": patch
---

Add CI pipeline with typecheck, lint, build, and security audit steps.

Add missing package.json metadata: `author`, `homepage`, `bugs`, and `sideEffects: false`. Fix `repository.url` to use the correct `git+https` prefix.

Update `publish-preview.yml` to patch the pkg-pr-new PR comment so the "Open in StackBlitz" link opens in a new tab (`target="_blank"`).
