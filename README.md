# create-cf-token

A CLI for creating Cloudflare API tokens (User Token) with an interactive, guided prompt flow.

> [!NOTE]
> Almost all **Lines of Code** was generated utilsing AI and not much manual oversight from me excl. review tools, if you spot an issue or something you don't like with it, submit an Issue / PR or fork it to implement this as you wish.
> Security Issues, submit via [Discord](https://discord.com/users/611746802122620937) or [X](https://x.com/mynameistito) Direct Messages. My handle on both platform's is `mynameistito`.

## Why

Creating API tokens through the Cloudflare dashboard involves navigating nested menus and clicking through dozens of checkboxes to scope permissions. This tool replaces that with a fast, terminal-native workflow — pick your accounts, select services, choose read/write access, and you're done.

## Features

- **Interactive prompts** — select accounts and scope permissions without leaving the terminal
- **Service-grouped permissions** — permissions are grouped by service (DNS, Firewall, SSL, etc.) with a read/write access level picker
- **Auto-retry with restricted permission handling** — if the API rejects a permission, the tool automatically excludes it and retries up to 50 times

## Prerequisites

- Node.js 18+
- A Cloudflare **Global API Key** (found under My Profile > API Tokens)
- Your Cloudflare account email

Optionally, set `CF_EMAIL` to skip the email prompt.

## Install

```bash
npx create-cf-token
```

Or install globally:

```bash
npm install -g create-cf-token
create-cf-token
```

## Flow

1. Authenticate with your Cloudflare email and Global API Key
2. Select which accounts the token should cover
3. Pick services and choose read or read+write access for each
4. Name the token
5. Token is printed to the terminal — **save it immediately**, it won't be shown again

## Dev

```bash
bun install
bun run start    # run from source
bun run build    # build to dist/
bun run check    # lint + typecheck
bun run fix      # auto-fix issues
```

## License

[MIT](LICENSE)
