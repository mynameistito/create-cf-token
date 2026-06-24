# src/auth/

## OVERVIEW

Cloudflare dashboard URL helpers for obtaining a scoped API token. No network calls.

## STRUCTURE

```
auth/
└── template-url.ts    # CF_API_TOKENS_URL, CF_AUTH_TEMPLATE_URL, buildAuthTemplateUrl
```

## WHERE TO LOOK

| Symbol                        | Role                                                 |
| ----------------------------- | ---------------------------------------------------- |
| `CF_API_TOKENS_URL`           | Dashboard API tokens page                            |
| `CF_AUTH_TEMPLATE_URL`        | Pre-built template URL with required permission keys |
| `buildAuthTemplateUrl(perms)` | Post-auth URL using live permission group keys       |

## CONVENTIONS

- Required permission keys: `user_details:read`, `api_tokens:edit`, `account_settings:read`.
- Re-exported via `prompts/index.ts` — orchestrator imports from prompts, not auth directly.
- `buildAuthTemplateUrl` matches `user` and `account` scopes from `PermissionGroup[]`.

## ANTI-PATTERNS

- fetch or token validation here
- Importing `@clack/prompts`
