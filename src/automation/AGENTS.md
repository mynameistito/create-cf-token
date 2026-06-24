# src/automation/

## OVERVIEW

Non-interactive token creation, JSON spec parsing, scope discovery, and agent skill paths. Published as `create-cf-token/create`, `./spec`, `./scope-spec`.

## STRUCTURE

```
automation/
├── create.ts       # createTokenFromSpec — programmatic entry (tsdown: create)
├── spec.ts         # TokenSpec parse/normalize (tsdown: spec)
├── scope-spec.ts   # Scope/preset permission resolution (tsdown: scope-spec)
├── runner.ts       # runAutomationCreate, runDiscovery, shouldRunAutomation
├── discovery.ts    # formatScopesList, formatPermissionsList, formatAccountsList
└── paths.ts        # Skill file paths, readAutomationFile
```

## WHERE TO LOOK

| Task                       | Location                                    | Notes                                                         |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Create from JSON spec      | `create.ts`                                 | `createTokenFromSpec(ctx, spec, deps?)`                       |
| Parse spec file/JSON       | `spec.ts`                                   | `parseTokenSpecJson`, `readTokenSpecFromFile`                 |
| Resolve scope permissions  | `scope-spec.ts`                             | `resolvePermissionsFromScopeSpec`, `resolvePresetPermissions` |
| CLI automation routing     | `runner.ts`                                 | Called from `cli/flags.ts` `runAutomationIfNeeded`            |
| `--discover` output        | `discovery.ts` + `runner.ts` `runDiscovery` | Lists scopes, permissions, accounts                           |
| `--skill` file paths       | `paths.ts`                                  | `getSkillPath`, `SKILL_REFERENCE_FILES`                       |
| Non-interactive validation | `cli/args.ts`                               | `validateNonInteractiveSpec`, `hasCompleteTokenSpec`          |

## CONVENTIONS

- Spec schema: `assets/token-spec.schema.json` (shipped in npm `files`).
- Skill source: `assets/automation/` → synced to `skill/create-cf-token/` via `scripts/sync-skill.ts`.
- `createTokenFromSpec` shares retry/exclusion logic with interactive flow via `buildPolicies` + API client.
- Errors: `TokenSpecError`, `ScopeSpecError`, `CreateFlowError` — bases in `errors/bases.ts`.
- Discovery output format: `json` | `table` via `CliArgs.format`; token output mode: `json` | `text` via `CliArgs.output` in `cli/args.ts`.

## ANTI-PATTERNS

- Interactive prompts in automation paths — fail fast via `failIfNonInteractiveIncomplete`
- Parsing specs outside `spec.ts` / `scope-spec.ts`
- Hardcoding skill paths — use `paths.ts`
