# create-cf-token — Agent Skill

Use this tool when you need to create Cloudflare API tokens programmatically: CI/CD pipelines, Terraform hooks, onboarding scripts, or agent workflows that need least-privilege tokens after inspecting available scopes.

## Prerequisites

- A **parent** Cloudflare API token with:
  - User Details: Read
  - User API Tokens: Edit
  - Account Settings: Read
- Set `CF_API_TOKEN` to the parent token (never pass tokens on the command line).

## Workflow

1. **Discover** — list accounts, scopes, and raw permission groups
2. **Spec** — declare desired access (flags, env, or JSON file)
3. **Dry-run** — review resolved policies before creating
4. **Create** — emit structured JSON output with the new token secret

## Quick commands

```bash
# Full agent playbook (this document + all references)
create-cf-token --skill

# Flag reference and copy-paste examples
create-cf-token --help automation

# Discover scopes as JSON (no token created)
create-cf-token --list-scopes --json

# Create a scoped token non-interactively
create-cf-token -n --name "ci-deploy" --accounts all \
  --scopes "Workers Scripts:write" --output json
```

## Security

- Use `--output json` so the token secret goes to stdout; progress goes to stderr.
- In GitHub Actions, mask the token: `echo "::add-mask::$TOKEN_VALUE"`
- Prefer `CF_API_TOKEN` env var over inline flags.
- `--dry-run` never prints a real token value.

## References

See the sections below for scope spec formats, discovery JSON shapes, token spec schema, recipes, programmatic API, and troubleshooting.
