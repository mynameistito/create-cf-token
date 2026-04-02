export interface PermissionGroup {
  description: string;
  id: string;
  name: string;
  scopes: string[];
}

export interface Account {
  id: string;
  name: string;
}

export interface UserInfo {
  email: string;
  id: string;
}

export interface CreatedToken {
  id: string;
  name: string;
  value: string;
}

export interface Policy {
  effect: "allow";
  permission_groups: { id: string }[];
  resources: Record<string, string>;
}

export interface ServiceGroup {
  name: string;
  otherPerms: PermissionGroup[];
  perms: PermissionGroup[];
  readPerm?: PermissionGroup;
  scopes: string[];
  writePerm?: PermissionGroup;
}
