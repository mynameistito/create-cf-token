import { TokenDeletionFlowErrorBase } from "@/errors/bases.ts";

/** Terminal failure in the interactive token-delete flow (not published from `create-cf-token/errors`). */
export class TokenDeletionFlowError extends TokenDeletionFlowErrorBase {}
