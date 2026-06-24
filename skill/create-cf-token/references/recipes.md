# Recipes

## CI deploy token (full access)

```bash
export CF_API_TOKEN="parent-token-with-token-edit"

create-cf-token -n \
  --preset full-access \
  --name "github-actions-deploy" \
  --output json
```

## Workers CI (scoped)

```bash
create-cf-token -n \
  --name "workers-ci" \
  --accounts "abc123def456" \
  --scopes "Workers Scripts:write,Workers KV Storage:read" \
  --output json
```

## Review policies before creating

```bash
create-cf-token -n \
  --dry-run \
  --name "review" \
  --accounts all \
  --scopes "Zone DNS:read,Workers Routes:read"
```

## GitHub Actions

```yaml
- name: Create Cloudflare token
  env:
    CF_API_TOKEN: ${{ secrets.CF_PARENT_TOKEN }}
  run: |
    RESULT=$(bunx create-cf-token -n \
      --name "ci-${{ github.run_id }}" \
      --accounts "${{ vars.CF_ACCOUNT_ID }}" \
      --scopes "Workers Scripts:write" \
      --output json)
    TOKEN=$(echo "$RESULT" | jq -r '.value')
    echo "::add-mask::$TOKEN"
    echo "CF_DEPLOY_TOKEN=$TOKEN" >> "$GITHUB_ENV"
```

## Agent discovery workflow

```bash
# Step 1: discover
create-cf-token --list-scopes --json > scopes.json
create-cf-token --list-accounts --json > accounts.json

# Step 2: dry-run
create-cf-token -n --dry-run --name x --accounts all --scopes "Zone DNS:read"

# Step 3: create
create-cf-token -n --name "agent-token" --accounts all --scopes "Zone DNS:read" --output json
```

## Config file from stdin

```bash
echo '{"name":"pipe-token","preset":"full-access"}' | \
  create-cf-token create --file -
```
