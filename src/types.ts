/** A single Cloudflare permission group with its metadata and assignable scopes. */
export interface PermissionGroup {
  /** Human-readable description of what this permission grants. */
  description: string;
  /** Unique identifier for this permission group (used in policy construction). */
  id: string;
  /** Dashboard key used in API token template URLs (e.g. `zone_dns`). */
  key?: string;
  /** Display name, e.g. `"Zone DNS Read"` or `"Account Settings Edit"`. */
  name: string;
  /** Scopes this permission belongs to (e.g. `com.cloudflare.api.account.zone`). */
  scopes: string[];
}

/** A Cloudflare account returned by the `/accounts` endpoint. */
export interface Account {
  /** Account identifier used in resource URIs. */
  id: string;
  /** Human-readable account name. */
  name: string;
}

/** A single policy entry for a Cloudflare user token. */
export interface TokenPolicy {
  effect: "allow" | "deny";
  permission_groups: { id: string }[];
  resources: Record<string, string>;
}

/** A created Cloudflare user token, as returned by POST /user/tokens. */
export interface CreatedToken {
  id: string;
  name: string;
  /** The token secret — only present on creation, never returned again. */
  value: string;
}

/** Authenticated user info returned by the `/user` endpoint. */
export interface UserInfo {
  /** The user's email address. */
  email: string;
  /** The user's unique identifier. */
  id: string;
}

/**
 * A service-level grouping of permissions, produced by {@linkcode groupByService}.
 * Groups permissions that share the same base name (e.g. "Zone DNS Read" and "Zone DNS Write" → "Zone DNS").
 */
export interface ServiceGroup {
  /** The common base name shared by all grouped permissions. */
  name: string;
  /** Permissions that are neither read nor write (e.g. edit, custom actions). */
  otherPerms: PermissionGroup[];
  /** All permission groups under this service. */
  perms: PermissionGroup[];
  /** The read-level permission, if present in the group. */
  readPerm?: PermissionGroup;
  /** Deduplicated scopes across all permissions in this group. */
  scopes: string[];
  /** The write-level permission, if present in the group. */
  writePerm?: PermissionGroup;
}
