# Discovery JSON shapes

All discovery commands support `--format json` (default when stdin is not a TTY) and `--format table`.

## `create-cf-token --list-scopes --json`

```json
{
  "scopes": [
    {
      "name": "Workers Scripts",
      "scopes": ["com.cloudflare.api.account"],
      "access": {
        "read": {
          "id": "...",
          "key": "workers_scripts",
          "name": "Workers Scripts Read"
        },
        "write": {
          "id": "...",
          "key": "workers_scripts",
          "name": "Workers Scripts Write"
        }
      },
      "other": []
    }
  ]
}
```

## `create-cf-token --list-permissions --json`

```json
{
  "permissions": [
    {
      "id": "abc123",
      "key": "zone_dns",
      "name": "Zone DNS Read",
      "description": "...",
      "scopes": ["com.cloudflare.api.account.zone"]
    }
  ]
}
```

## `create-cf-token --list-accounts --json`

```json
{
  "accounts": [{ "id": "abc123def456", "name": "My Account" }]
}
```

All discovery commands exit 0 and require `CF_API_TOKEN` but do not create a token.
