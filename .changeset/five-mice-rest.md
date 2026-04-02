---
"create-cf-token": patch
---

Harden permission-related error handling by replacing vulnerable regex parsing,
avoiding false-positive permission extraction, and gracefully handling non-JSON
Cloudflare token create/delete error responses.
