# src/policies/

## OVERVIEW

Pure policy construction from permission selections. Published as `create-cf-token/policies`.

## STRUCTURE

```
policies/
└── build.ts    # buildPolicies(perms, userId, accounts, excluded?)
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Build CF API policy array | `build.ts` `buildPolicies` |
| Filter excluded perms | Uses `isPermissionExcluded` from `permissions/group.ts` |

## CONVENTIONS

- Pure function — no I/O, no side effects. Safe for `test.concurrent`.
- Splits permissions into user / account / zone policy objects by scope strings.
- `excluded` is a `Set<string>` of permission names skipped on retry after `RestrictedPermissionError`.
- Re-exported from `index.ts` for interactive flow; imported directly by `automation/create.ts`.

## ANTI-PATTERNS

- fetch, prompts, or terminal output here
- Duplicating scope-bucketing logic outside this function
