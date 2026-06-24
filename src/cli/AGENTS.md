# src/cli/

## OVERVIEW

CLI argument parsing, early-exit flags, help text, and entry orchestration (`run.ts`).

## STRUCTURE

```
cli/
├── args.ts    # parseCliArgs, CliArgs, non-interactive validation
├── flags.ts   # handleFlags, handleSkillFlag, runAutomationIfNeeded
├── help.ts    # printHelp, printAutomationHelp, printSkill, printVersion
└── run.ts     # run(deps?) — flags → skill → automation → main
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add CLI flag | `args.ts` parse loop + `CliArgs` interface; wire in `flags.ts` |
| Help / version output | `help.ts` — `console.log` acceptable here |
| Automation routing | `flags.ts` `runAutomationIfNeeded` → `automation/runner.ts` |
| Non-interactive validation | `args.ts` `validateNonInteractiveSpec`, `hasCompleteTokenSpec` |
| Entry orchestration | `run.ts` — deps-injectable for tests |

## CONVENTIONS

- `parseCliArgs` returns `CliArgs | CliParseError` — callers check `"error" in parsed`.
- `handleFlags` returns `true` when it handled argv (help, version, parse error exit).
- `command: "skill"` defers to `handleSkillFlag()` (async file read).
- Discovery commands (`list-scopes`, `list-permissions`, `list-accounts`) route through automation runner.
- Re-exported from `index.ts`: `handleFlags`, `handleSkillFlag`, `parseArgv`, `runAutomationIfNeeded`, `ParsedCli`.

## ANTI-PATTERNS

- Interactive prompts in cli/ — delegate to `prompts/` or `index.ts`
- `fetch` or API calls here
- Shebang in `run.ts` or sibling files (only tsdown injects on `cli` chunk)
