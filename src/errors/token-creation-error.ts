import { TokenCreationErrorBase } from "@/errors/bases.ts";

/**
 * Error returned when `POST /user/tokens` fails for a reason other than a restricted permission
 * (those map to {@link RestrictedPermissionError} instead).
 */
export class TokenCreationError extends TokenCreationErrorBase {
  constructor(args: { errorText: string }) {
    super({
      ...args,
      message: `Token creation failed: ${args.errorText}`,
    });
  }
}
