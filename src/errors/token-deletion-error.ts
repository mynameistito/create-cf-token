import { TokenDeletionErrorBase } from "@/errors/bases.ts";

export class TokenDeletionError extends TokenDeletionErrorBase {
  constructor(args: { errorText: string }) {
    super({
      ...args,
      message: `Token deletion failed: ${args.errorText}`,
    });
  }
}
