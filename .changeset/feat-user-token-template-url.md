---
"create-cf-token": minor
---

Switch from Global API Key + email authentication to scoped user token (Bearer auth). Token creation now calls the Cloudflare API directly from the CLI instead of generating a dashboard URL. `CF_EMAIL` environment variable removed; `CF_API_TOKEN` now expects a scoped token with `User Details:Read`, `User API Tokens:Edit`, and `Account Settings:Read` permissions.

Cloudflare has recently changed the process for generating tokens. I recommend using their dashboard to generate them, as it now offers a much smoother and more user-friendly experience. At the time of writing, this flow only supports "Account Tokens" and does not yet include "User Tokens".
