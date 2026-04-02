# create-cf-token

A CLI for creating Cloudflare API tokens (User Token) with an interactive, guided prompt flow.

> **Disclaimer:** This project is not affiliated with, endorsed by, or supported by Cloudflare, Inc. Cloudflare and the Cloudflare logo are trademarks of Cloudflare, Inc.


## Why

Creating API tokens through the Cloudflare dashboard involves navigating nested menus and clicking through dozens of checkboxes to scope permissions. This tool replaces that with a fast, terminal-native workflow — pick your accounts, select scopes, choose read/write access, and you're done.

## Features

- **Interactive prompts with live fuzzy filtering** — type to quickly narrow accounts and scopes without leaving the terminal
- **Scope selection with service-grouped permissions** — permissions are grouped by service (DNS, Firewall, SSL, etc.) with a read/write access level picker
- **Auto-retry with restricted permission handling** — if the API rejects a permission, the tool automatically excludes it and retries up to 50 times
- **Immediate revoke and optional cleanup** — revoke the token you just created right away, or delete kept tokens from the current session before exit

## Prerequisites

- Node.js 22+
- A Cloudflare **Global API Key** (found under My Profile > API Tokens)
- Your Cloudflare account email

Optionally, set `CF_EMAIL` to automatically supply your email and skip the interactive email prompt.
Optionally, set `CF_API_TOKEN` to automatically supply your Global API Key and skip the interactive API key prompt.

## Install

```bash
bun create cf-token@latest      # via bunx
npm create cf-token@latest      # via npx
pnpm create cf-token@latest     # via pnpm dlx
```

Or install globally:

```bash
bun install -g create-cf-token@latest       # via bun
create-cf-token

npm install -g create-cf-token@latest       # via npm
create-cf-token

pnpm install -g create-cf-token@latest      # via pnpm
create-cf-token
```

## Flow

1. Authenticate with your Cloudflare email and Global API Key
2. Select which accounts the token should cover by typing to filter the list
3. Pick scopes and choose read or read+write access for each, again with live fuzzy filtering
4. Name the token
5. Token is printed to the terminal — **save it immediately**, it won't be shown again
6. Choose whether to keep the just-created token, revoke it immediately, or delete kept session tokens before exiting

## Dev

```bash
bun install
bun run dev           # run from source
bun run build           # build to dist/
bun run check           # lint check
bun run typecheck       # typecheck
bun run fix             # auto-fix issues
```

## License

[MIT](LICENSE)

## Disclaimer
> [!NOTE]
> Almost all **Lines of Code** were generated utilising AI and not much manual oversight from me excl. review tools, if you spot an issue or something you don't like with it, submit an Issue / PR or fork it to implement this as you wish.
> Security Issues, submit via [Discord](https://discord.com/users/611746802122620937) or [X](https://x.com/mynameistito) Direct Messages. My handle on both platform's is `mynameistito`.
[**mynameistito**](https://github.com/mynameistito) 31/03/2026

See [Disclaimer](#create-cf-token) above.
