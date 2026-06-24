import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type { TestServer } from "@tests/helpers/test-server.ts";
import {
  errorResponse,
  startTestServer,
  successResponse,
} from "@tests/helpers/test-server.ts";

import {
  createToken,
  deleteToken,
  getAccounts,
  getPermissionGroups,
  getUser,
} from "@/api/client.ts";
import {
  CloudflareApiError,
  RestrictedPermissionError,
  TokenCreationError,
  TokenDeletionError,
} from "@/errors/index.ts";
import type { TokenPolicy } from "@/types/index.ts";

const USER_FIXTURE = { email: "test@example.com", id: "user-123" };
const ACCOUNTS_FIXTURE = [{ id: "acct-1", name: "Acme Corp" }];
const TOKEN_FIXTURE = { id: "tok-1", name: "My Token", value: "secret-abc123" };
const PERMISSION_GROUPS_FIXTURE = [
  {
    description: "Read DNS records",
    id: "perm-dns-read",
    name: "DNS Read",
    scopes: ["com.cloudflare.api.account.zone"],
  },
];

describe.serial("getUser", () => {
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

  test.serial("returns Ok with user info on success", async () => {
    const result = await getUser("my-token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("user-123");
      expect(result.value.email).toBe("test@example.com");
    }
  });
});

describe.serial("getUser — API error", () => {
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

  test.serial(
    "returns Err(CloudflareApiError) when success is false",
    async () => {
      const result = await getUser("bad-token");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(CloudflareApiError);
      }
    }
  );
});

describe.serial("auth headers", () => {
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

  test.serial("sends Authorization Bearer header", async () => {
    await getUser("my-api-token");
    expect(capturedHeaders.authorization).toBe("Bearer my-api-token");
  });
});

describe.serial("getAccounts", () => {
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

  test.serial("returns Ok with accounts on success", async () => {
    const result = await getAccounts("my-token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0]?.id).toBe("acct-1");
      expect(result.value[0]?.name).toBe("Acme Corp");
    }
  });
});

describe.serial("getAccounts — pagination", () => {
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

  test.serial("aggregates accounts across multiple pages", async () => {
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

describe.serial("CF_API_BASE_URL", () => {
  let server: TestServer;
  let requestUrl: string | null = null;
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    server = startTestServer({
      "/user": (req) => {
        requestUrl = req.url;
        return successResponse(USER_FIXTURE);
      },
    });
    process.env.CF_API_BASE_URL = `${server.baseUrl}/`;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
    globalThis.fetch = originalFetch;
  });

  test.serial("trims trailing slashes from a custom base URL", async () => {
    await getUser("my-token");
    expect(requestUrl).toBe(`${server.baseUrl}/user`);
  });

  test.serial(
    "uses the Cloudflare default when the env var is blank",
    async () => {
      process.env.CF_API_BASE_URL = "   ";
      let capturedUrl = "";
      globalThis.fetch = ((input) => {
        capturedUrl = String(input);
        return Promise.resolve(
          Response.json({ result: USER_FIXTURE, success: true })
        );
      }) as typeof fetch;

      await getUser("my-token");

      expect(capturedUrl).toBe("https://api.cloudflare.com/client/v4/user");
      process.env.CF_API_BASE_URL = `${server.baseUrl}/`;
      globalThis.fetch = originalFetch;
    }
  );
});

describe.serial("getAccounts — empty page", () => {
  let server: TestServer;
  let requestCount = 0;

  beforeAll(() => {
    server = startTestServer({
      "/accounts": (req) => {
        requestCount += 1;
        const url = new URL(req.url);
        const page = Number(url.searchParams.get("page") ?? "1");
        if (page === 1) {
          return successResponse([], {
            count: 0,
            page: 1,
            per_page: 50,
            total_count: 0,
          });
        }
        return successResponse([{ id: "unexpected", name: "Unexpected" }]);
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial("stops pagination when the first page is empty", async () => {
    requestCount = 0;
    const result = await getAccounts("my-token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([]);
    }
    expect(requestCount).toBe(1);
  });
});

describe.serial("getAccounts — partial final page without total_count", () => {
  let server: TestServer;
  let requestCount = 0;

  beforeAll(() => {
    server = startTestServer({
      "/accounts": (req) => {
        requestCount += 1;
        const url = new URL(req.url);
        const page = Number(url.searchParams.get("page") ?? "1");
        if (page === 1) {
          return successResponse([{ id: "acct-only", name: "Only Account" }], {
            count: 1,
            page: 1,
            per_page: 50,
          });
        }
        return successResponse([{ id: "unexpected", name: "Unexpected" }]);
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial(
    "stops after a short page when total_count is absent",
    async () => {
      requestCount = 0;
      const result = await getAccounts("my-token");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]?.id).toBe("acct-only");
      }
      expect(requestCount).toBe(1);
    }
  );
});

describe.serial("getAccounts — total_count reached on first page", () => {
  let server: TestServer;
  let requestCount = 0;

  beforeAll(() => {
    server = startTestServer({
      "/accounts": () => {
        requestCount += 1;
        return successResponse(ACCOUNTS_FIXTURE, {
          count: 1,
          page: 1,
          per_page: 50,
          total_count: 1,
        });
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial("stops when accumulated items meet total_count", async () => {
    requestCount = 0;
    const result = await getAccounts("my-token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(1);
    }
    expect(requestCount).toBe(1);
  });
});

describe.serial("getAccounts — invalid JSON on list page", () => {
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
        return { rawBody: "not-json", status: 502 };
      },
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial(
    "returns Err(CloudflareApiError) when a later page is not JSON",
    async () => {
      const result = await getAccounts("my-token");
      expect(result.isErr()).toBe(true);
      if (result.isErr() && CloudflareApiError.is(result.error)) {
        expect(result.error.messages).toEqual([
          "HTTP 502: Invalid JSON response",
        ]);
      }
    }
  );
});

describe.serial("getAccounts — pagination error", () => {
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

  test.serial(
    "returns Err(CloudflareApiError) when a later page fails",
    async () => {
      const result = await getAccounts("my-token");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(CloudflareApiError);
      }
    }
  );
});

describe.serial("createToken", () => {
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

  test.serial("returns Ok with created token on success", async () => {
    const result = await createToken("my-token", "My Token", []);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe("tok-1");
      expect(result.value.name).toBe("My Token");
      expect(result.value.value).toBe("secret-abc123");
    }
  });

  test.serial("sends name and policies in the request body", async () => {
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

  test.serial("sends Authorization Bearer header", async () => {
    await createToken("my-api-token", "Test", []);
    expect(capturedAuthHeader).toBe("Bearer my-api-token");
  });
});

describe.serial("createToken — restricted permission", () => {
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

  test.serial(
    "returns Err(RestrictedPermissionError) when permission group is named in error",
    async () => {
      const result = await createToken("my-token", "My Token", []);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(RestrictedPermissionError);
        if (result.error instanceof RestrictedPermissionError) {
          expect(result.error.permissionName).toBe("DNS Write");
        }
      }
    }
  );
});

describe.serial("createToken — generic failure", () => {
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

  test.serial(
    "returns Err(TokenCreationError) for non-restricted failures",
    async () => {
      const result = await createToken("my-token", "My Token", []);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(TokenCreationError);
      }
    }
  );
});

describe.serial("createToken — non-JSON response", () => {
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

  test.serial(
    "treats non-JSON error responses as token creation failures",
    async () => {
      const result = await createToken("my-token", "Test", []);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(TokenCreationError);
      }
    }
  );
});

describe.serial("createToken — restricted perm in raw text fallback", () => {
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

  test.serial(
    "falls back to raw response text when structured messages miss the permission name",
    async () => {
      const result = await createToken("my-token", "Test", []);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(RestrictedPermissionError);
        if (result.error instanceof RestrictedPermissionError) {
          expect(result.error.permissionName).toBe("DNS Write");
        }
      }
    }
  );
});

describe.serial("createToken — sub-token cannot manage other tokens", () => {
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

  test.serial(
    "returns Err(RestrictedPermissionError) mapped to API Tokens service",
    async () => {
      const result = await createToken("my-token", "Test", []);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(RestrictedPermissionError);
        if (result.error instanceof RestrictedPermissionError) {
          expect(result.error.permissionName).toBe("API Tokens");
        }
      }
    }
  );
});

describe.serial("getPermissionGroups", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens/permission_groups": successResponse(
        PERMISSION_GROUPS_FIXTURE
      ),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial("returns Ok with permission groups on success", async () => {
    const result = await getPermissionGroups("my-token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value[0]?.name).toBe("DNS Read");
      expect(result.value[0]?.id).toBe("perm-dns-read");
    }
  });
});

describe.serial("getPermissionGroups — API error", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens/permission_groups": errorResponse(["Forbidden"]),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial(
    "returns Err(CloudflareApiError) when success is false",
    async () => {
      const result = await getPermissionGroups("bad-token");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(CloudflareApiError);
      }
    }
  );
});

describe.serial("deleteToken — success", () => {
  let server: TestServer;

  beforeAll(() => {
    server = startTestServer({
      "/user/tokens/tok-123": successResponse({ id: "tok-123" }),
      "/user/tokens/tok-fallback": successResponse({}),
    });
    process.env.CF_API_BASE_URL = server.baseUrl;
  });

  afterAll(() => {
    server.stop();
    delete process.env.CF_API_BASE_URL;
  });

  test.serial("returns Ok(id) on successful deletion", async () => {
    const result = await deleteToken("tok-123", "my-token");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe("tok-123");
    }
  });

  test.serial(
    "falls back to the requested token id when result.id is missing",
    async () => {
      const result = await deleteToken("tok-fallback", "my-token");
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe("tok-fallback");
      }
    }
  );
});

describe.serial("deleteToken — failure", () => {
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

  test.serial("returns Err(TokenDeletionError) on failure", async () => {
    const result = await deleteToken("tok-bad", "my-token");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TokenDeletionError);
    }
  });
});

describe.serial("deleteToken — non-JSON response", () => {
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

  test.serial(
    "treats non-JSON error responses as token deletion failures",
    async () => {
      const result = await deleteToken("tok-err", "my-token");
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(TokenDeletionError);
      }
    }
  );
});

describe.serial("API error parsing — malformed HTML", () => {
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

  test.serial(
    "returns Err(CloudflareApiError) for non-JSON 502 body",
    async () => {
      const result = await getUser("my-token");
      expect(result.isErr()).toBe(true);
      if (result.isErr() && CloudflareApiError.is(result.error)) {
        expect(result.error.messages).toEqual([
          "HTTP 502: Invalid JSON response",
        ]);
      }
    }
  );
});

describe.serial("API error parsing — missing errors array", () => {
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

  test.serial(
    "returns Err(CloudflareApiError) with empty messages",
    async () => {
      const result = await getUser("my-token");
      expect(result.isErr()).toBe(true);
      if (result.isErr() && CloudflareApiError.is(result.error)) {
        expect(result.error.messages).toEqual([]);
      }
    }
  );
});
