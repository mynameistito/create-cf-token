import { TokenDeletionErrorBase } from "@/errors/bases.ts";

/** Error returned when `DELETE /user/tokens/:id` fails. */
export class TokenDeletionError extends TokenDeletionErrorBase {
  constructor(args: { errorText: string }) {
    super({
      ...args,
      message: `Token deletion failed: ${args.errorText}`,
    });
  }
}
