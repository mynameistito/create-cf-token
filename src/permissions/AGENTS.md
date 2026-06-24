# src/permissions/

## OVERVIEW

Permission grouping for interactive UI and full-access preset resolution. `group.ts` published as `create-cf-token/permissions`.

## STRUCTURE

```
permissions/
├── group.ts     # groupByService, extractFailedPerm, isPermissionExcluded (tsdown entry)
└── resolve.ts   # resolveFullAccessPermissions, bulk access helpers
```

## WHERE TO LOOK

| Task                             | Location                                                            |
| -------------------------------- | ------------------------------------------------------------------- |
| Group perms by service for UI    | `group.ts` `groupByService`                                         |
| Parse failed perm from API error | `group.ts` `extractFailedPerm`                                      |
| Exclude perm on retry            | `group.ts` `isPermissionExcluded`                                   |
| Full-access preset selection     | `resolve.ts` `resolveFullAccessPermissions`                         |
| Read vs write bulk logic         | `resolve.ts` `shouldUseBulkAccessLevel`, `appendServicePermissions` |

## CONVENTIONS

- `TOKEN_MANAGEMENT_SERVICE` ("API Tokens") — sub-tokens cannot grant these; filtered in grouping.
- Scopes bucketed by `com.cloudflare.api.user`, `.account`, `.account.zone` strings.
- `resolve.ts` re-exported via `prompts/index.ts` for UI; `group.ts` used by API and `policies/`.
- Action suffixes: `" Read"`, `" Write"`, `" Edit"` parsed from permission names.

## ANTI-PATTERNS

- Policy construction here — belongs in `policies/build.ts`
- API calls or fetch
