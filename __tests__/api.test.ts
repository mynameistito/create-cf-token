import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createToken,
  getAccounts,
  getPermissionGroups,
  getUser,
} from "#src/api.ts";
import { CloudflareApiError } from "#src/errors.ts";
import type { TokenPolicy } from "#src/types.ts";
import type { TestServer } from "./helpers/test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "./helpers/test-server.ts";

const USER_FIXTURE = { id: "user-123", email: "test@example.com" };
const PERMS_FIXTURE = [
  {
    id: "perm-1",
    key: "zone_dns",
    name: "DNS Read",
    description: "Read DNS",
    scopes: ["com.cloudflare.api.account.zone"],
  },
];
const ACCOUNTS_FIXTURE = [{ id: "acct-1", name: "Acme Corp" }];
const TOKEN_FIXTURE = { id: "tok-1", name: "My Token", value: "secret-abc123" };

describe("getUser", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user": successResponse(USER_FIXTURE),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Ok with user info on success", async () => {
    const result = await getUser("my-token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("user-123");
      expect(result.value.email).toBe("test@example.com");
    }
  });
});

describe("getUser — API error", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user": errorResponse(["Invalid API token"]),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Err(CloudflareApiError) when success is false", async () => {
    const result = await getUser("bad-token");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(CloudflareApiError);
    }
  });
});

describe("getPermissionGroups", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens/permission_groups": successResponse(PERMS_FIXTURE),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Ok with permission groups on success", async () => {
    const result = await getPermissionGroups("my-token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0]?.name).toBe("DNS Read");
    }
  });
});

describe("auth headers", () => {
  let server: TestServer;
  let capturedHeaders: Record<string, string> = {};

  beforeAll(() => {
    server = startTestServer({
      "/user": (req) => {
        capturedHeaders = Object.fromEntries(req.headers.entries());
        return successResponse(USER_FIXTURE);
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("sends Authorization Bearer header", async () => {
    await getUser("my-api-token");
    expect(capturedHeaders.authorization).toBe("Bearer my-api-token");
  });
});

describe("getAccounts", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/accounts": successResponse(ACCOUNTS_FIXTURE),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Ok with accounts on success", async () => {
    const result = await getAccounts("my-token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0]?.id).toBe("acct-1");
      expect(result.value[0]?.name).toBe("Acme Corp");
    }
  });
});

describe("createToken", () => {
  let server: TestServer;
  let capturedBody: unknown;
  let capturedAuthHeader: string | null;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": async (req) => {
        capturedBody = await req.json();
        capturedAuthHeader = req.headers.get("authorization");
        return successResponse(TOKEN_FIXTURE);
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Ok with created token on success", async () => {
    const result = await createToken("my-token", "My Token", []);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("tok-1");
      expect(result.value.name).toBe("My Token");
      expect(result.value.value).toBe("secret-abc123");
    }
  });

  test("sends name and policies in the request body", async () => {
    const policies: TokenPolicy[] = [
      {
        effect: "allow",
        resources: {
          "com.cloudflare.api.account.acct-1": {
            "com.cloudflare.api.account.zone.*": "*",
          },
        },
        permission_groups: [{ id: "perm-1" }],
      },
    ];
    await createToken("my-token", "Zone Token", policies);
    expect(capturedBody).toEqual({ name: "Zone Token", policies });
  });

  test("sends Authorization Bearer header", async () => {
    await createToken("my-api-token", "Test", []);
    expect(capturedAuthHeader).toBe("Bearer my-api-token");
  });
});

describe("createToken — API error", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": errorResponse(["Insufficient permissions"]),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Err(CloudflareApiError) when success is false", async () => {
    const result = await createToken("bad-token", "Test", []);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(CloudflareApiError);
    }
  });
});
