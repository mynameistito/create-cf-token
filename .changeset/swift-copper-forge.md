---
"create-cf-token": major
---

Add changesets versioning and GitHub Actions release workflow with hardened CI configuration.

Introduces automated versioning via Changesets and a GitHub Actions release workflow that creates version bump PRs and publishes to npm with provenance attestation. The workflow is hardened with all action references pinned to full commit SHAs to prevent supply-chain attacks. Removes a redundant build step that was causing double compilation on publish (the `prepublishOnly` hook handles building during `changeset publish`). Adds the `--provenance` flag to the local `release` script to keep it consistent with the CI workflow.
