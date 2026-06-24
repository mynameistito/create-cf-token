import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { createToken, deleteToken, getAccounts, getUser } from "#src/api.ts";
import {
  CloudflareApiError,
  RestrictedPermissionError,
  TokenCreationError,
  TokenDeletionError,
} from "#src/errors.ts";
import type { TokenPolicy } from "#src/types.ts";

import type { TestServer } from "./helpers/test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "./helpers/test-server.ts";

const USER_FIXTURE = { email: "test@example.com", id: "user-123" };
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
      "/accounts": successResponse(ACCOUNTS_FIXTURE, {
        count: 1,
        page: 1,
        per_page: 50,
        total_count: 1,
      }),
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

describe("getAccounts — pagination", () => {
  let server: TestServer;
  const page1Accounts = Array.from({ length: 50 }, (_, index) => ({
    id: `acct-${index}`,
    name: `Account ${index}`,
  }));
  const page2Accounts = [{ id: "acct-50", name: "Account 50" }];

  beforeAll(() => {
    server = startTestServer({
      "/accounts": (req) => {
        const url = new URL(req.url);
        const page = Number(url.searchParams.get("page") ?? "1");
        const perPage = Number(url.searchParams.get("per_page") ?? "50");

        if (page === 1) {
          return successResponse(page1Accounts, {
            count: 50,
            page: 1,
            per_page: perPage,
            total_count: 51,
          });
        }
        if (page === 2) {
          return successResponse(page2Accounts, {
            count: 1,
            page: 2,
            per_page: perPage,
            total_count: 51,
          });
        }
        return successResponse([], {
          count: 0,
          page,
          per_page: perPage,
          total_count: 51,
        });
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("aggregates accounts across multiple pages", async () => {
    const result = await getAccounts("my-token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(51);
      expect(result.value[0]?.id).toBe("acct-0");
      expect(result.value[49]?.id).toBe("acct-49");
      expect(result.value[50]?.id).toBe("acct-50");
    }
  });
});

describe("getAccounts — pagination error", () => {
  let server: TestServer;
  const page1Accounts = Array.from({ length: 50 }, (_, index) => ({
    id: `acct-${index}`,
    name: `Account ${index}`,
  }));

  beforeAll(() => {
    server = startTestServer({
      "/accounts": (req) => {
        const url = new URL(req.url);
        const page = Number(url.searchParams.get("page") ?? "1");

        if (page === 1) {
          return successResponse(page1Accounts, {
            count: 50,
            page: 1,
            per_page: 50,
            total_count: 51,
          });
        }
        return errorResponse(["Rate limited"]);
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Err(CloudflareApiError) when a later page fails", async () => {
    const result = await getAccounts("my-token");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(CloudflareApiError);
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
        return successResponse({
          id: TOKEN_FIXTURE.id,
          value: TOKEN_FIXTURE.value,
        });
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
        permission_groups: [{ id: "perm-1" }],
        resources: {
          "com.cloudflare.api.account.acct-1": {
            "com.cloudflare.api.account.zone.*": "*",
          },
        },
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

describe("createToken — restricted permission", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": {
        body: {
          errors: [
            {
              message:
                'A selected permission cannot be granted (Permission group: "DNS Write")',
            },
          ],
          success: false,
        },
        status: 400,
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Err(RestrictedPermissionError) when permission group is named in error", async () => {
    const result = await createToken("my-token", "My Token", []);
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
    const result = await createToken("my-token", "My Token", []);
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
      "/user/tokens": { rawBody: "upstream gateway error", status: 502 },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("treats non-JSON error responses as token creation failures", async () => {
    const result = await createToken("my-token", "Test", []);
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
        body: {
          detail:
            'A selected permission cannot be granted (Permission group: "DNS Write")',
          errors: [{ message: "request validation failed" }],
          success: false,
        },
        status: 400,
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("falls back to raw response text when structured messages miss the permission name", async () => {
    const result = await createToken("my-token", "Test", []);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(RestrictedPermissionError);
      if (result.error instanceof RestrictedPermissionError) {
        expect(result.error.permissionName).toBe("DNS Write");
      }
    }
  });
});

describe("createToken — sub-token cannot manage other tokens", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens": errorResponse([
        "sub-token is not allowed to have permissions to manage other tokens",
      ]),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Err(RestrictedPermissionError) mapped to API Tokens service", async () => {
    const result = await createToken("my-token", "Test", []);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(RestrictedPermissionError);
      if (result.error instanceof RestrictedPermissionError) {
        expect(result.error.permissionName).toBe("API Tokens");
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
    const result = await deleteToken("tok-123", "my-token");
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
    const result = await deleteToken("tok-bad", "my-token");
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
        rawBody: "upstream gateway error",
        status: 502,
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("treats non-JSON error responses as token deletion failures", async () => {
    const result = await deleteToken("tok-err", "my-token");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TokenDeletionError);
    }
  });
});

describe("API error parsing — malformed HTML", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user": {
        rawBody: "<html><body>Bad Gateway</body></html>",
        status: 502,
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Err(CloudflareApiError) for non-JSON 502 body", async () => {
    const result = await getUser("my-token");
    expect(result.isErr()).toBe(true);
    if (result.isErr() && CloudflareApiError.is(result.error)) {
      expect(result.error.messages).toEqual([
        "HTTP 502: Invalid JSON response",
      ]);
    }
  });
});

describe("API error parsing — missing errors array", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user": {
        body: { result: null, success: false },
        status: 400,
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test("returns Err(CloudflareApiError) with empty messages", async () => {
    const result = await getUser("my-token");
    expect(result.isErr()).toBe(true);
    if (result.isErr() && CloudflareApiError.is(result.error)) {
      expect(result.error.messages).toEqual([]);
    }
  });
});
