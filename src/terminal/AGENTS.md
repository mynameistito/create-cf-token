# src/terminal/

## OVERVIEW

Low-level terminal output primitives — ANSI colour, OSC-8 hyperlinks, boxed notes. No `@clack` imports.

## STRUCTURE

```
terminal/
├── colour.ts      # Default export: 5 ANSI codes (British spelling intentional)
├── hyperlink.ts   # hyperlinkUrl — OSC-8 terminal links
└── note.ts        # printNote — bordered info boxes
```

## WHERE TO LOOK

| Task                    | Location              |
| ----------------------- | --------------------- |
| ANSI colour constants   | `colour.ts`           |
| Clickable terminal URLs | `hyperlink.ts`        |
| Info/warning boxes      | `note.ts` `printNote` |

## CONVENTIONS

- `colour.ts` is a default export object — import as `import colour from "#src/terminal/colour.ts"`.
- `hyperlinkUrl` and `printNote` re-exported through `prompts/index.ts` for orchestrator use.
- Safe to import from `prompts/` and `index.ts`; never import `@clack/prompts` here.

## ANTI-PATTERNS

- `@clack/prompts` in this tree
- American spelling `color` for the module filename
- Business logic or API calls
