import { TokenDeletionErrorBase } from "#src/errors/bases.ts";

export class TokenDeletionError extends TokenDeletionErrorBase {
  constructor(args: { errorText: string }) {
    super({
      ...args,
      message: `Token deletion failed: ${args.errorText}`,
    });
  }
}
