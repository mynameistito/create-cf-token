# Token spec schema

Non-interactive creation accepts a JSON file via `create --file`:

```bash
create-cf-token create --file token-spec.json
create-cf-token create --file -
```

## Schema

```json
{
  "name": "my-token",
  "preset": "full-access",
  "accounts": "all",
  "scopes": "Workers Scripts:write,Zone DNS:read",
  "dryRun": false,
  "output": "json"
}
```

| Field      | Type                 | Required                | Description                                   |
| ---------- | -------------------- | ----------------------- | --------------------------------------------- |
| `name`     | string               | yes                     | Token display name                            |
| `preset`   | `"full-access"`      | no                      | All accounts + all scopes at read+write       |
| `accounts` | string or string[]   | when using `scopes`     | `"all"`, comma-separated IDs, or array of IDs |
| `scopes`   | string               | when not using `preset` | Same format as `--scopes` flag                |
| `dryRun`   | boolean              | no                      | Print policies without creating               |
| `output`   | `"json"` \| `"text"` | no                      | Output format on success                      |

Either `preset: "full-access"` or a `scopes` string is required.

The canonical JSON Schema ships at `assets/token-spec.schema.json` in the npm package.
