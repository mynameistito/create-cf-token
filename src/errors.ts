import { TaggedError } from "better-result";

/**
 * Error returned when a Cloudflare API GET request fails.
 * Wraps the API path and all error messages from the response body.
 */
export class CloudflareApiError extends TaggedError("CloudflareApiError")<{
  path: string;
  messages: string[];
  message: string;
}>() {
  constructor(args: { path: string; messages: string[] }) {
    super({
      ...args,
      message: `CF API error (${args.path}): ${args.messages.join(", ")}`,
    });
  }
}
