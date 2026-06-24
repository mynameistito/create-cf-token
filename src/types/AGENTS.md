# src/types/

## OVERVIEW

Shared TypeScript interfaces for API responses and policy construction. Type-only published export (`create-cf-token/types`).

## STRUCTURE

```
types/
└── index.ts    # PermissionGroup, Account, TokenPolicy, CreatedToken, UserInfo, ServiceGroup
```

## WHERE TO LOOK

| Interface | Used by |
|-----------|---------|
| `PermissionGroup` | API client, permissions, policies, prompts, auth |
| `Account` | API client, policies, automation spec |
| `TokenPolicy` | `buildPolicies`, `createToken` |
| `CreatedToken` | API client, flows, automation |
| `UserInfo` | API client, orchestrator |
| `ServiceGroup` | `groupByService` return type |

## CONVENTIONS

- tsdown `types` entry emits `.d.mts` only — no runtime bundle.
- Scope strings on `PermissionGroup.scopes` are Cloudflare API identifiers (not invented here).
- `TokenPolicyResourceValue` is `"*"` or `Record<string, "*">` for zone resources.

## ANTI-PATTERNS

- Runtime logic or exports with side effects
- Duplicating these shapes inline in other modules
