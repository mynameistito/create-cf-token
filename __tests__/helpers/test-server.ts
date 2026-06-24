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
    async fetch(req) {
      const url = new URL(req.url);
      const handler = routes[url.pathname];

      if (!handler) {
        return Response.json(
          {
            errors: [{ message: "Not found" }],
            success: false,
          },
          {
            headers: { "Content-Type": "application/json" },
            status: 404,
          }
        );
      }

      const resolved = await (typeof handler === "function"
        ? handler(req)
        : handler);
      const body =
        typeof resolved.rawBody === "string"
          ? resolved.rawBody
          : JSON.stringify(resolved.body);
      const contentType =
        typeof resolved.rawBody === "string"
          ? "text/plain"
          : "application/json";
      return new Response(body, {
        headers: { "Content-Type": contentType },
        status: resolved.status ?? 200,
      });
    },
    hostname: "127.0.0.1",
    port: 0,
  });

  return {
    baseUrl: `http://127.0.0.1:${server.port}`,
    stop: () => server.stop(),
  };
}

export interface CfResultInfo {
  count?: number;
  page?: number;
  per_page?: number;
  total_count?: number;
}

export function successResponse<T>(
  result: T,
  resultInfo?: CfResultInfo
): RouteHandler {
  const body: Record<string, unknown> = { errors: [], result, success: true };
  if (resultInfo) {
    body.result_info = resultInfo;
  }
  return { body };
}

export function errorResponse(messages: string[], status = 400): RouteHandler {
  return {
    body: {
      errors: messages.map((message) => ({ message })),
      result: null,
      success: false,
    },
    status,
  };
}
