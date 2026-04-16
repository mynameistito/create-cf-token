export interface RouteHandler {
  body?: unknown;
  rawBody?: string;
  status?: number;
}

export type Routes = Record<
  string,
  RouteHandler | ((req: Request) => RouteHandler | Promise<RouteHandler>)
>;

export interface TestServer {
  baseUrl: string;
  stop: () => void;
}

export function startTestServer(routes: Routes): TestServer {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const handler = routes[url.pathname];

      if (!handler) {
        return new Response(
          JSON.stringify({
            success: false,
            errors: [{ message: "Not found" }],
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const resolved = await (typeof handler === "function" ? handler(req) : handler);
      const body =
        typeof resolved.rawBody === "string"
          ? resolved.rawBody
          : JSON.stringify(resolved.body);
      const contentType =
        typeof resolved.rawBody === "string"
          ? "text/plain"
          : "application/json";
      return new Response(body, {
        status: resolved.status ?? 200,
        headers: { "Content-Type": contentType },
      });
    },
  });

  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    stop: () => server.stop(),
  };
}

export function successResponse<T>(result: T): RouteHandler {
  return { body: { success: true, result, errors: [] } };
}

export function errorResponse(messages: string[], status = 400): RouteHandler {
  return {
    status,
    body: {
      success: false,
      result: null,
      errors: messages.map((message) => ({ message })),
    },
  };
}
