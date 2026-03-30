import {
  cancel,
  isCancel,
  multiselect,
  password,
  select,
  text,
} from "@clack/prompts";
import type { Account, PermissionGroup, ServiceGroup } from "./types.ts";

function check<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return value as T;
}

export async function askCredentials(): Promise<{
  email: string;
  apiKey: string;
}> {
  const email = check(
    await text({
      message: "Cloudflare email",
      initialValue: process.env.CF_EMAIL,
      validate: (v) => (v ? undefined : "Email is required"),
    })
  );

  const apiKey = check(
    await password({
      message: "Global API Key",
      validate: (v) => (v ? undefined : "API key is required"),
    })
  );

  return { email, apiKey };
}

export async function selectAccounts(accounts: Account[]): Promise<Account[]> {
  const ids = check(
    await multiselect({
      message: "Select accounts",
      options: accounts.map((a) => ({
        value: a.id,
        label: a.name,
        hint: a.id,
      })),
      required: true,
    })
  );
  return accounts.filter((a) => ids.includes(a.id));
}

export async function selectServices(
  services: ServiceGroup[]
): Promise<PermissionGroup[]> {
  const selected = check(
    await multiselect({
      message: "Select services",
      options: services.map((svc) => {
        const levels = svc.perms.map(
          (pg) => pg.name.replace(svc.name, "").trim() || pg.name
        );
        const scopeLabels = svc.scopes.map((s) => s.split(".").pop());
        return {
          value: svc.name,
          label: svc.name,
          hint: `${levels.join(", ")} [${scopeLabels.join(", ")}]`,
        };
      }),
      required: true,
    })
  );

  const chosen: PermissionGroup[] = [];

  for (const serviceName of selected) {
    const svc = services.find((s) => s.name === serviceName);
    if (!svc) {
      continue;
    }

    // Always include non-read/write perms (e.g. "Cache Purge")
    chosen.push(...svc.otherPerms);

    if (svc.readPerm && svc.writePerm) {
      const level = check(
        await select({
          message: `${svc.name} — access level`,
          options: [
            { value: "read", label: "Read only" },
            { value: "write", label: "Read + Write" },
          ],
        })
      );
      chosen.push(svc.readPerm);
      if (level === "write") {
        chosen.push(svc.writePerm);
      }
    } else {
      if (svc.readPerm) {
        chosen.push(svc.readPerm);
      }
      if (svc.writePerm) {
        chosen.push(svc.writePerm);
      }
    }
  }

  return chosen;
}

export async function askTokenName(defaultName: string): Promise<string> {
  return check(
    await text({
      message: "Token name",
      initialValue: defaultName,
      validate: (v) => (v ? undefined : "Name is required"),
    })
  );
}
