import { CloudflareApiErrorBase } from "@/errors/bases.ts";

export class CloudflareApiError extends CloudflareApiErrorBase {
  constructor(args: { path: string; messages: string[] }) {
    super({
      ...args,
      message: `CF API error (${args.path}): ${args.messages.join(", ")}`,
    });
  }
}
