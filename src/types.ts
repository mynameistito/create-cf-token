/** A single Cloudflare permission group with its metadata and assignable scopes. */
export interface PermissionGroup {
  /** Human-readable description of what this permission grants. */
  description: string;
  /** Unique identifier for this permission group (used in policy construction). */
  id: string;
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

/** Authenticated user info returned by the `/user` endpoint. */
export interface UserInfo {
  /** The user's email address. */
  email: string;
  /** The user's unique identifier. */
  id: string;
}

/** A newly created API token returned by the `/user/tokens` POST endpoint. */
export interface CreatedToken {
  /** The token's unique identifier (for revocation/management). */
  id: string;
  /** The name assigned to the token at creation. */
  name: string;
  /** The full secret token value — only available at creation time. */
  value: string;
}

/**
 * A single policy entry in a Cloudflare API token definition.
 * Each policy grants `"allow"` access to a set of permission groups over a set of resources.
 */
export interface Policy {
  /** Always `"allow"` — Cloudflare tokens currently only support allow policies. */
  effect: "allow";
  /** Permission group IDs this policy grants. */
  permission_groups: { id: string }[];
  /** Resource URIs mapped to access levels (typically `"*"` for all). */
  resources: Record<string, string>;
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
