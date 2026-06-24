#!/usr/bin/env bash
# Apply the OpenSSF Scorecard Branch-Protection ruleset for main.
# Requires a GitHub token with admin:repo_hook or repo admin access.
set -euo pipefail

repo="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

gh api "repos/${repo}/rulesets" -X POST \
  --input - <<'EOF'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "deletion",
      "parameters": {}
    },
    {
      "type": "non_fast_forward",
      "parameters": {}
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "audit" },
          { "context": "audit:npm" },
          { "context": "build" },
          { "context": "check" },
          { "context": "knip" },
          { "context": "security:scan" },
          { "context": "test" },
          { "context": "typecheck" },
          { "context": "e2e-node (22)" },
          { "context": "e2e-node (24)" }
        ]
      }
    }
  ]
}
EOF

echo "Created ruleset: Protect main"
