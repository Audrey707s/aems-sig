// =============================================================================
// Standard AEMS Domain Error Format & Error Codes (Blueprint R.02 Bab 14.7 & 19.2)
// =============================================================================

export type AemsErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "DUPLICATE_KEY"
  | "HAS_ACTIVE_CHILDREN"
  | "MAKER_CHECKER_VIOLATION"
  | "AE001" // Cycle detected (Hierarki melingkar)
  | "AE002" // Max hierarchy depth exceeded
  | "AE003" // Already has an active parent slot
  | "AE004" // Equipment already has an open mapping request
  | "AE010" // Equipment not found or inactive
  | "AE011" // Target parent (asset/equipment) not found or inactive
  | "AE012" // Target parent is already the current active parent
  | "FILE_INVALID"
  | "BATCH_ALREADY_COMMITTED"
  | "INTERNAL_ERROR";

export class AemsError extends Error {
  public readonly code: AemsErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: AemsErrorCode,
    message: string,
    httpStatus = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AemsError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export function formatErrorResponse(err: unknown, requestId?: string) {
  const reqId = requestId || crypto.randomUUID();
  if (err instanceof AemsError) {
    return {
      status: err.httpStatus,
      body: {
        error: {
          code: err.code,
          message: err.message,
          details: err.details || {},
          request_id: reqId,
        },
      },
    };
  }

  const msg = err instanceof Error ? err.message : "Terjadi kesalahan internal pada server.";
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: msg,
        details: {},
        request_id: reqId,
      },
    },
  };
}
