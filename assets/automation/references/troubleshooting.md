# Troubleshooting

## Exits immediately with "Cancelled" on non-TTY

Interactive mode requires a terminal. Use non-interactive mode:

```bash
create-cf-token -n --name "my-token" --preset full-access --output json
```

Or set `CREATE_CF_TOKEN_NON_INTERACTIVE=1`.

## "Non-interactive mode requires --name"

Provide a complete spec:

```bash
create-cf-token -n --name "x" --accounts all --scopes "Zone DNS:read"
```

## "Unknown service" or "Unknown permission key"

Run discovery first:

```bash
create-cf-token --list-scopes --json
create-cf-token --list-permissions --json
```

Service names are case-insensitive. Permission keys come from the API `key` field.

## "Unknown account ID"

```bash
create-cf-token --list-accounts --json
```

Use exact account IDs or `all`.

## Authentication failures

Your parent `CF_API_TOKEN` needs:

- User Details: Read
- User API Tokens: Edit
- Account Settings: Read

Create a scoped parent token in the Cloudflare dashboard.

## Restricted permissions excluded

Some permissions (e.g. API Tokens management) cannot be granted by sub-tokens. The tool retries up to 50 times, auto-excluding restricted permissions. Check stderr for excluded permission names.

## Token secret not shown again

The token `value` is only returned on creation. Use `--output json` and save it immediately. In CI, mask the value in logs.

## Incomplete spec on piped stdin

When stdin is not a TTY and no complete spec is provided, the CLI fails fast with an actionable error instead of hanging.
