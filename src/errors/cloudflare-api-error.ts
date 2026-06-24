import { CloudflareApiErrorBase } from "@/errors/bases.ts";

/** Error returned when a Cloudflare REST request fails (non-OK HTTP, invalid JSON, or `success: false`). */
export class CloudflareApiError extends CloudflareApiErrorBase {
  constructor(args: { path: string; messages: string[] }) {
    super({
      ...args,
      message: `CF API error (${args.path}): ${args.messages.join(", ")}`,
    });
  }
}
