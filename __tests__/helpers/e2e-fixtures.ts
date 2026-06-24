export const USER_FIXTURE = { email: "test@example.com", id: "user-123" };

export const ACCOUNTS_FIXTURE = [{ id: "acct-1", name: "Acme Corp" }];

export const CLI_PERMS_FIXTURE = [
  {
    description: "Read DNS",
    id: "perm-1",
    key: "zone_dns",
    name: "DNS Read",
    scopes: ["com.cloudflare.api.account.zone"],
  },
];

export const AUTOMATION_PERMS_FIXTURE = [
  {
    description: "Read DNS",
    id: "perm-read",
    key: "zone_dns",
    name: "Zone DNS Read",
    scopes: ["com.cloudflare.api.account.zone"],
  },
  {
    description: "Write DNS",
    id: "perm-write",
    key: "zone_dns",
    name: "Zone DNS Write",
    scopes: ["com.cloudflare.api.account.zone"],
  },
];

export const AUTH_FAILURE_RE = /token|authentication|unauthorized/iu;
export const SEMVER_RE = /^\d+\.\d+\.\d+/u;
export const SHEBANG_RE = /^#!/u;
