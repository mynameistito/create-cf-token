# Scope spec formats

The `--scopes` flag accepts a comma-separated list. Three formats are supported:

## 1. Service name + access level

```
Workers Scripts:write,Zone DNS:read,Account Settings:read
```

- Service names match the interactive multiselect labels (case-insensitive).
- Access level is `read` or `write`.
- `write` includes read + write permissions and edit-class `otherPerms`.

## 2. Permission keys

```
workers_scripts:write,zone_dns:read,account_settings:read
```

- Keys come from the Cloudflare API `key` field on permission groups.
- Run `create-cf-token --list-permissions --json` to discover keys.

## 3. Exact permission names

```
"Workers Scripts Write","Zone DNS Read"
```

- Use quotes when names contain commas.
- Names must match exactly (case-insensitive).

## Full-access preset

Skip `--scopes` entirely with `--preset full-access`:

```bash
create-cf-token -n --preset full-access --name "full-access-token" --output json
```

This grants all accounts and all scopes at read+write, excluding API Tokens management.
