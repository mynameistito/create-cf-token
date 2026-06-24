import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { Result, UnhandledException } from "better-result";

import {
  CreateFlowError,
  createTokenFromSpec,
} from "#src/automation/create.ts";
import type { CreateTokenContext } from "#src/automation/create.ts";
import { RestrictedPermissionError } from "#src/errors/restricted-permission-error.ts";
import type { PermissionGroup, ServiceGroup } from "#src/types/index.ts";

import type { TestServer } from "../helpers/test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "../helpers/test-server.ts";

const USER = { email: "test@example.com", id: "user-123" };
const ACCOUNTS = [{ id: "acct-1", name: "Acme Corp" }];

const SCOPES: ServiceGroup[] = [
  {
    name: "Zone DNS",
    otherPerms: [],
    perms: [],
    readPerm: {
      description: "",
      id: "read-1",
      key: "zone_dns",
      name: "Zone DNS Read",
      scopes: ["com.cloudflare.api.account.zone"],
    },
    scopes: ["com.cloudflare.api.account.zone"],
    writePerm: {
      description: "",
      id: "write-1",
      key: "zone_dns",
      name: "Zone DNS Write",
      scopes: ["com.cloudflare.api.account.zone"],
    },
  },
];

const API_TOKEN_SCOPES: ServiceGroup[] = [
  {
    name: "API Tokens",
    otherPerms: [],
    perms: [],
    readPerm: {
      description: "",
      id: "api-read",
      key: "api_tokens",
      name: "API Tokens Read",
      scopes: ["com.cloudflare.api.user"],
    },
    scopes: ["com.cloudflare.api.user"],
    writePerm: {
      description: "",
      id: "api-write",
      key: "api_tokens",
      name: "API Tokens Write",
      scopes: ["com.cloudflare.api.user"],
    },
  },
];

const ALL_PERMS: PermissionGroup[] = [
  SCOPES[0]?.readPerm,
  SCOPES[0]?.writePerm,
].filter((perm): perm is PermissionGroup => perm !== undefined);

const API_TOKEN_PERMS: PermissionGroup[] = [
  API_TOKEN_SCOPES[0]?.readPerm,
  API_TOKEN_SCOPES[0]?.writePerm,
].filter((perm): perm is PermissionGroup => perm !== undefined);

function buildContext(apiToken = "test-token"): CreateTokenContext {
  return {
    accounts: ACCOUNTS,
    allPerms: ALL_PERMS,
    apiToken,
    scopes: SCOPES,
    user: USER,
  };
}

function buildApiTokenContext(apiToken = "test-token"): CreateTokenContext {
  return {
    accounts: ACCOUNTS,
    allPerms: API_TOKEN_PERMS,
    apiToken,
    scopes: API_TOKEN_SCOPES,
    user: USER,
  };
}

describe.serial("createTokenFromSpec — dry run", () => {
  let server: TestServer;
  let postCalled = false;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": () => {
        postCalled = true;
        return successResponse({ id: "tok-1", value: "secret" });
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial("returns policies without POSTing to the API", async () => {
    postCalled = false;

    const result = await createTokenFromSpec(
      {
        dryRun: true,
        name: "dry-run-token",
        preset: "full-access",
      },
      buildContext()
    );

    expect(result.isOk()).toBe(true);
    expect(postCalled).toBe(false);

    if (result.isOk()) {
      expect(result.value.token).toBeUndefined();
      expect(result.value.excludedPermissions).toEqual([]);
      expect(result.value.policies.length).toBeGreaterThan(0);
      expect(result.value.policies[0]?.permission_groups).toEqual([
        { id: "read-1" },
        { id: "write-1" },
      ]);
    }
  });
});

describe.serial("createTokenFromSpec — full-access preset", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": successResponse({
        id: "tok-1",
        value: "secret-abc123",
      }),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial("creates a token for all accounts", async () => {
    const result = await createTokenFromSpec(
      {
        name: "full-access-token",
        preset: "full-access",
      },
      buildContext()
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.token).toEqual({
        id: "tok-1",
        name: "full-access-token",
        value: "secret-abc123",
      });
      expect(result.value.policies.length).toBeGreaterThan(0);
    }
  });
});

describe.serial("createTokenFromSpec — account resolution", () => {
  test.serial(
    "returns Err(CreateFlowError) for unknown account IDs",
    async () => {
      const result = await createTokenFromSpec(
        {
          accounts: "missing-acct",
          name: "bad-account-token",
          preset: "full-access",
        },
        buildContext()
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(CreateFlowError.is(result.error)).toBe(true);
        if (CreateFlowError.is(result.error)) {
          expect(result.error.message).toContain(
            "Unknown account ID(s): missing-acct"
          );
        }
      }
    }
  );

  test.serial('selects all accounts when accounts is "all"', async () => {
    const server = startTestServer({
      "/user/tokens": successResponse({
        id: "tok-all",
        value: "secret-all",
      }),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;

    try {
      const result = await createTokenFromSpec(
        {
          accounts: "all",
          name: "all-accounts-token",
          scopes: "Zone DNS:read",
        },
        buildContext()
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.token?.id).toBe("tok-all");
        const zonePolicy = result.value.policies.find(
          (policy) =>
            policy.resources &&
            "com.cloudflare.api.account.acct-1" in policy.resources
        );
        expect(zonePolicy).toBeDefined();
      }
    } finally {
      server.stop();
      delete process.env.CF_API_BASE_URL;
    }
  });

  test.serial("selects explicitly requested account IDs", async () => {
    const server = startTestServer({
      "/user/tokens": successResponse({
        id: "tok-specific-account",
        value: "secret-specific-account",
      }),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;

    try {
      const result = await createTokenFromSpec(
        {
          accounts: "acct-1",
          name: "specific-account-token",
          scopes: "Zone DNS:read",
        },
        buildContext()
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.token?.id).toBe("tok-specific-account");
        expect(
          result.value.policies[0]?.resources?.[
            "com.cloudflare.api.account.acct-1"
          ]
        ).toEqual({ "com.cloudflare.api.account.zone.*": "*" });
      }
    } finally {
      server.stop();
      delete process.env.CF_API_BASE_URL;
    }
  });

  test.serial(
    "returns Err(CreateFlowError) when accounts string is empty",
    async () => {
      const result = await createTokenFromSpec(
        {
          accounts: "   ",
          name: "empty-accounts-token",
          scopes: "Zone DNS:read",
        },
        buildContext()
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(CreateFlowError.is(result.error)).toBe(true);
        if (CreateFlowError.is(result.error)) {
          expect(result.error.message).toBe(
            'Accounts required. Use "all" or comma-separated account IDs.'
          );
        }
      }
    }
  );

  test.serial(
    "returns Err(CreateFlowError) when scoped spec omits accounts",
    async () => {
      const result = await createTokenFromSpec(
        {
          name: "missing-accounts-token",
          scopes: "Zone DNS:read",
        },
        buildContext()
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(CreateFlowError.is(result.error)).toBe(true);
        if (CreateFlowError.is(result.error)) {
          expect(result.error.message).toBe(
            'Accounts required. Use "all" or comma-separated account IDs.'
          );
        }
      }
    }
  );
});

describe.serial("createTokenFromSpec — restricted permission retry", () => {
  let server: TestServer;
  let attempt = 0;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": () => {
        attempt += 1;
        if (attempt === 1) {
          return {
            body: {
              errors: [
                {
                  message:
                    'A selected permission cannot be granted (Permission group: "Zone DNS Write")',
                },
              ],
              success: false,
            },
            status: 400,
          };
        }

        return successResponse({
          id: "tok-retry",
          value: "secret-after-retry",
        });
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial(
    "retries after RestrictedPermissionError and succeeds",
    async () => {
      attempt = 0;

      const result = await createTokenFromSpec(
        {
          name: "retry-token",
          preset: "full-access",
        },
        buildContext()
      );

      expect(result.isOk()).toBe(true);
      expect(attempt).toBe(2);

      if (result.isOk()) {
        expect(result.value.token?.value).toBe("secret-after-retry");
        expect(result.value.excludedPermissions).toContain("Zone DNS Write");
      }
    }
  );
});

describe.serial("createTokenFromSpec — token creation failure", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": errorResponse(["Something went wrong"]),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial("maps TokenCreationError to CreateFlowError", async () => {
    const result = await createTokenFromSpec(
      {
        name: "failed-token",
        preset: "full-access",
      },
      buildContext()
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(CreateFlowError.is(result.error)).toBe(true);
      if (CreateFlowError.is(result.error)) {
        expect(result.error.message).toContain("Error creating token:");
        expect(result.error.message).toContain("Something went wrong");
      }
    }
  });

  test.serial("maps UnhandledException to CreateFlowError", async () => {
    const result = await createTokenFromSpec(
      {
        name: "unexpected-token",
        preset: "full-access",
      },
      buildContext(),
      {
        createToken: () =>
          Promise.resolve(
            Result.err(
              new UnhandledException({ cause: new Error("socket closed") })
            )
          ),
      }
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(CreateFlowError.is(result.error)).toBe(true);
      if (CreateFlowError.is(result.error)) {
        expect(result.error.message).toContain("Unexpected error:");
        expect(result.error.message).toContain("socket closed");
      }
    }
  });

  test.serial("stops retrying after 50 restricted permissions", async () => {
    const result = await createTokenFromSpec(
      {
        name: "too-many-retries-token",
        preset: "full-access",
      },
      buildContext(),
      {
        createToken: () =>
          Promise.resolve(
            Result.err(
              new RestrictedPermissionError({
                errorText: "Phantom permission is restricted",
                permissionName: "Phantom Permission",
              })
            )
          ),
      }
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(CreateFlowError.is(result.error)).toBe(true);
      if (CreateFlowError.is(result.error)) {
        expect(result.error.message).toContain("Failed after 50 attempts");
      }
    }
  });
});

describe.serial("createTokenFromSpec — malformed spec", () => {
  test.serial(
    "returns Err(CreateFlowError) when scopes and preset are absent",
    async () => {
      const result = await createTokenFromSpec(
        {
          accounts: "all",
          name: "missing-scope-token",
        },
        buildContext()
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(CreateFlowError.is(result.error)).toBe(true);
        if (CreateFlowError.is(result.error)) {
          expect(result.error.message).toBe(
            "Token spec requires scopes or preset full-access."
          );
        }
      }
    }
  );
});

describe.serial("createTokenFromSpec — all permissions restricted", () => {
  let server: TestServer;
  let postCalled = false;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": () => {
        postCalled = true;
        return successResponse({ id: "tok-1", value: "secret" });
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial(
    "aborts when every selected permission is restricted",
    async () => {
      postCalled = false;

      const result = await createTokenFromSpec(
        {
          accounts: "all",
          name: "restricted-only-token",
          scopes: "API Tokens:read",
        },
        buildApiTokenContext()
      );

      expect(result.isErr()).toBe(true);
      expect(postCalled).toBe(false);

      if (result.isErr()) {
        expect(CreateFlowError.is(result.error)).toBe(true);
        if (CreateFlowError.is(result.error)) {
          expect(result.error.message).toBe(
            "All selected permissions were restricted. Aborting."
          );
        }
      }
    }
  );
});
