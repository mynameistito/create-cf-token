# Programmatic API

Import sub-exports from the `create-cf-token` package:

```typescript
import {
  getUser,
  getAccounts,
  getPermissionGroups,
  createToken,
} from "create-cf-token/api";
import { groupByService } from "create-cf-token/permissions";
import { createTokenFromSpec } from "create-cf-token/create";
import type { TokenSpec } from "create-cf-token/spec";
```

## `createTokenFromSpec`

```typescript
import { createTokenFromSpec } from "create-cf-token/create";

const result = await createTokenFromSpec(
  { name: "my-token", scopes: "Workers Scripts:write", accounts: "all" },
  { apiToken, user, accounts, allPerms, scopes }
);

if (result.isOk()) {
  console.log(result.value.token?.value);
}
```

Returns `Result<CreateTokenFromSpecResult, CreateTokenFromSpecError>`.

On success:

- `token` — `{ id, name, value }` (omitted on dry-run)
- `policies` — resolved Cloudflare policy objects
- `excludedPermissions` — restricted permissions auto-excluded during retry

## Scope resolution

```typescript
import { resolvePermissionsFromScopeSpec } from "create-cf-token/scope-spec";

const perms = resolvePermissionsFromScopeSpec(
  scopes,
  allPerms,
  "Workers Scripts:write"
);
```

## Policy construction

```typescript
import { buildPolicies } from "create-cf-token/policies";

const policies = buildPolicies(perms, userId, selectedAccounts);
```

All API functions return `Result<T, E>` via `better-result` — never throw.
