import { TokenCreationErrorBase } from "#src/errors/bases.ts";

export class TokenCreationError extends TokenCreationErrorBase {
  constructor(args: { errorText: string }) {
    super({
      ...args,
      message: `Token creation failed: ${args.errorText}`,
    });
  }
}
