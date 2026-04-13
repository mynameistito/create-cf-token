import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createToken,
  deleteToken,
  getAccounts,
  getPermissionGroups,
  getUser,
} from "#src/api.ts";
import {
  CloudflareApiError,
  RestrictedPermissionError,
  TokenCreationError,
  TokenDeletionError,
} from "#src/errors.ts";
import type { TestServer } from "./helpers/test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "./helpers/test-server.ts";

const USER_FIXTURE = { id: "user-123", email: "test@example.com" };
const ACCOUNTS_FIXTURE = [{ id: "acct-1", name: "My Account" }];
const PERMS_FIXTURE = [
  {
    id: "perm-1",
    name: "DNS Read",
    description: "Read DNS",
    scopes: ["com.cloudflare.api.account.zone"],
  },
];

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
    const result = await getUser("key");
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
      "/user": errorResponse(["Invalid API key"]),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Err(CloudflareApiError) when success is false", async () => {
    const result = await getUser("key");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(CloudflareApiError);
    }
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

  test("returns Ok with accounts array on success", async () => {
    const result = await getAccounts("key");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.id).toBe("acct-1");
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
    const result = await getPermissionGroups("key");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0]?.name).toBe("DNS Read");
    }
  });
});

describe("createToken — success", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": successResponse({
        id: "tok-abc",
        value: "secret-token-value",
      }),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Ok(CreatedToken) on success", async () => {
    const result = await createToken("My Token", [], "key");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("tok-abc");
      expect(result.value.value).toBe("secret-token-value");
      expect(result.value.name).toBe("My Token");
    }
  });
});

describe("createToken — restricted permission", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": {
        status: 400,
        body: {
          success: false,
          errors: [
            {
              message:
                'A selected permission cannot be granted (Permission group: "DNS Write")',
            },
          ],
        },
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Err(RestrictedPermissionError) when permission group is named in error", async () => {
    const result = await createToken("My Token", [], "key");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(RestrictedPermissionError);
      if (result.error instanceof RestrictedPermissionError) {
        expect(result.error.permissionName).toBe("DNS Write");
      }
    }
  });
});

describe("createToken — generic failure", () => {
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

  test("returns Err(TokenCreationError) for non-restricted failures", async () => {
    const result = await createToken("My Token", [], "key");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TokenCreationError);
    }
  });
});

describe("createToken — non-JSON response", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": { status: 502, rawBody: "upstream gateway error" },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("treats non-JSON error responses as token creation failures", async () => {
    const result = await createToken("test", [], "api-key");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TokenCreationError);
    }
  });
});

describe("createToken — restricted perm in raw text fallback", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": {
        status: 400,
        body: {
          detail:
            'A selected permission cannot be granted (Permission group: "DNS Write")',
          errors: [{ message: "request validation failed" }],
          success: false,
        },
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("falls back to raw response text when structured messages miss the permission name", async () => {
    const result = await createToken("test", [], "api-key");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(RestrictedPermissionError);
      if (result.error instanceof RestrictedPermissionError) {
        expect(result.error.permissionName).toBe("DNS Write");
      }
    }
  });
});

describe("deleteToken — success", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens/tok-123": successResponse({ id: "tok-123" }),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Ok(id) on successful deletion", async () => {
    const result = await deleteToken("tok-123", "key");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("tok-123");
    }
  });
});

describe("deleteToken — failure", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens/tok-bad": errorResponse(["Token not found"], 404),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Err(TokenDeletionError) on failure", async () => {
    const result = await deleteToken("tok-bad", "key");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TokenDeletionError);
    }
  });
});

describe("deleteToken — non-JSON response", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens/tok-err": {
        status: 502,
        rawBody: "upstream gateway error",
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("treats non-JSON error responses as token deletion failures", async () => {
    const result = await deleteToken("tok-err", "api-key");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TokenDeletionError);
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
    await getUser("my-api-key");
    expect(capturedHeaders.authorization).toBe("Bearer my-api-key");
  });
});
