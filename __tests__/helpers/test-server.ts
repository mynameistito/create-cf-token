export interface RouteHandler {
  body: unknown;
  status?: number;
}

export type Routes = Record<
  string,
  RouteHandler | ((req: Request) => RouteHandler)
>;

export interface TestServer {
  baseUrl: string;
  stop: () => void;
}

export function startTestServer(routes: Routes): TestServer {
  const server = Bun.serve({
    port: 0,
    fetch(req) {
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

      const resolved = typeof handler === "function" ? handler(req) : handler;
      return new Response(JSON.stringify(resolved.body), {
        status: resolved.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  return {
    baseUrl: `http://localhost:${server.port}`,
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
