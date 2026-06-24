# src/api/

## OVERVIEW

Sole network layer. Cloudflare REST v4 via raw `fetch`. Published as `create-cf-token/api`.

## STRUCTURE

```
api/
└── client.ts    # cfGet (internal), getUser, getAccounts, getPermissionGroups, createToken, deleteToken
```

## WHERE TO LOOK

| Function              | Endpoint                             | Notes                                                   |
| --------------------- | ------------------------------------ | ------------------------------------------------------- |
| `getUser`             | GET `/user`                          | Validates token; returns `UserInfo`                     |
| `getAccounts`         | GET `/accounts`                      | Paginates 50/page until exhausted                       |
| `getPermissionGroups` | GET `/user/tokens/permission_groups` | All assignable groups                                   |
| `createToken`         | POST `/user/tokens`                  | Maps `RestrictedPermissionError` / `TokenCreationError` |
| `deleteToken`         | DELETE `/user/tokens/:id`            | `TokenDeletionError` on failure                         |

## CONVENTIONS

- All functions return `Result<T, E>` via `Result.tryPromise` — never throw.
- Bearer token passed as `apiToken` param — never stored in module state.
- Base URL from `process.env.CF_API_BASE_URL` or `https://api.cloudflare.com/client/v4`.
- `createToken` uses `extractFailedPerm` from `permissions/group.ts` for error messages.
- Internal `cfGet<T>` handles auth header, JSON envelope, and `CloudflareApiError`.

## ANTI-PATTERNS

- `fetch` anywhere outside this file
- Global API Key or email auth (Bearer only)
- Accessing `Result.value` without `isErr()` check at call sites
