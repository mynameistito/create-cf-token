---
"create-cf-token": patch
---

Add pkg.pr.new publish preview workflow for pull requests.

Introduces a GitHub Actions workflow that publishes an installable preview build for each pull request using pkg.pr.new. Also bumps `actions/checkout` to v6 and fixes the `prepare` script to use `|| true` so it does not fail in CI and pack contexts where lefthook is not available.
