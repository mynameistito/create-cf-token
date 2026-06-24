import { TokenCreationFlowErrorBase } from "@/errors/bases.ts";

/** Terminal failure in the interactive token-create flow (not published from `create-cf-token/errors`). */
export class TokenCreationFlowError extends TokenCreationFlowErrorBase {}
